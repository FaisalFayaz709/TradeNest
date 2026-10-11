from __future__ import annotations

from datetime import datetime, timezone
from math import log1p
from typing import Literal
from uuid import UUID

import numpy as np
import pandas as pd
from pydantic import BaseModel, ConfigDict, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

MODEL_VERSION = "recommendation-hybrid-v2"
EVENT_WEIGHTS: dict[str, float] = {
    "PRODUCT_VIEW": 1.0,
    "WISHLIST": 3.0,
    "ADD_TO_CART": 4.0,
    "PURCHASE": 8.0,
}
RECENCY_HALF_LIFE_DAYS = 30.0
PERSONALIZED_CONTENT_WEIGHT = 0.82
PERSONALIZED_CATEGORY_WEIGHT = 0.18
SIMILAR_CONTENT_WEIGHT = 0.85
SIMILAR_CATEGORY_WEIGHT = 0.15


class ProductFeature(BaseModel):
    model_config = ConfigDict(extra="forbid")

    productId: UUID
    categoryId: UUID
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=5000)


class BehaviorSignal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    productId: UUID
    eventType: Literal["PRODUCT_VIEW", "WISHLIST", "ADD_TO_CART", "PURCHASE"]
    occurredAt: datetime


class PersonalizedRecommendationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    events: list[BehaviorSignal] = Field(max_length=500)
    products: list[ProductFeature] = Field(max_length=500)
    limit: int = Field(ge=1, le=50)


class SimilarRecommendationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    targetProductId: UUID
    products: list[ProductFeature] = Field(max_length=501)
    limit: int = Field(ge=1, le=50)


class RecommendationItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    productId: UUID
    score: float = Field(ge=0.0, le=1.0)


class RecommendationSet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[RecommendationItem] = Field(max_length=50)
    modelVersion: str
    generatedAt: datetime


def _product_document(product: ProductFeature) -> str:
    # Category is modeled separately so its influence is explicit and bounded.
    return f"{product.name.strip()} {product.description.strip()}"


def _matrix(products: list[ProductFeature]):
    documents = [_product_document(product) for product in products]
    vectorizer = TfidfVectorizer(
        lowercase=True,
        strip_accents="unicode",
        ngram_range=(1, 2),
        sublinear_tf=True,
        max_features=30_000,
    )
    try:
        return vectorizer.fit_transform(documents)
    except ValueError:
        # Degenerate punctuation-only text still gets a deterministic character
        # representation instead of turning recommendation inference into 500.
        fallback = TfidfVectorizer(
            analyzer="char_wb",
            lowercase=True,
            ngram_range=(2, 4),
            sublinear_tf=True,
            max_features=30_000,
        )
        return fallback.fit_transform(documents)


def _rank(
    products: list[ProductFeature],
    scores: np.ndarray,
    limit: int,
    *,
    exclude: set[str] | None = None,
) -> list[RecommendationItem]:
    excluded = exclude or set()
    frame = pd.DataFrame(
        {
            "productId": [str(product.productId) for product in products],
            "score": np.clip(scores.astype(float), 0.0, 1.0),
        }
    )
    frame = frame[(frame["score"] > 0.0) & (~frame["productId"].isin(excluded))]
    frame = frame.sort_values(["score", "productId"], ascending=[False, True], kind="stable").head(limit)
    return [
        RecommendationItem(productId=UUID(row.productId), score=round(float(row.score), 6))
        for row in frame.itertuples(index=False)
    ]


def _event_strengths(
    events: list[BehaviorSignal],
    known_product_ids: set[str],
) -> dict[str, float]:
    matching = [signal for signal in events if str(signal.productId) in known_product_ids]
    if not matching:
        return {}

    newest = max(signal.occurredAt for signal in matching)
    by_product_and_type: dict[tuple[str, str], float] = {}
    for signal in matching:
        age_days = max(0.0, (newest - signal.occurredAt).total_seconds() / 86_400.0)
        recency = 0.5 ** (age_days / RECENCY_HALF_LIFE_DAYS)
        key = (str(signal.productId), signal.eventType)
        by_product_and_type[key] = by_product_and_type.get(key, 0.0) + recency

    # Repeated low-intent events saturate logarithmically instead of allowing
    # refresh/click volume to grow linearly without bound.
    product_strengths: dict[str, float] = {}
    for (product_id, event_type), effective_count in by_product_and_type.items():
        strength = EVENT_WEIGHTS[event_type] * log1p(effective_count)
        product_strengths[product_id] = product_strengths.get(product_id, 0.0) + strength
    return product_strengths


def _category_affinity(
    products: list[ProductFeature],
    product_strengths: dict[str, float],
) -> dict[str, float]:
    affinity: dict[str, float] = {}
    total = 0.0
    for product in products:
        strength = product_strengths.get(str(product.productId), 0.0)
        if strength <= 0.0:
            continue
        category_id = str(product.categoryId)
        affinity[category_id] = affinity.get(category_id, 0.0) + strength
        total += strength
    if total <= 0.0:
        return {}
    return {category_id: value / total for category_id, value in affinity.items()}


def personalized_recommendations(request: PersonalizedRecommendationRequest) -> RecommendationSet:
    generated_at = datetime.now(timezone.utc)
    if not request.products or not request.events:
        return RecommendationSet(items=[], modelVersion=MODEL_VERSION, generatedAt=generated_at)

    product_index = {str(product.productId): index for index, product in enumerate(request.products)}
    strengths = _event_strengths(request.events, set(product_index))
    if not strengths:
        return RecommendationSet(items=[], modelVersion=MODEL_VERSION, generatedAt=generated_at)

    matrix = _matrix(request.products)
    profile = np.zeros(matrix.shape[1], dtype=float)
    total_strength = 0.0
    for product_id, strength in strengths.items():
        profile += matrix[product_index[product_id]].toarray()[0] * strength
        total_strength += strength

    if total_strength <= 0.0 or not np.any(profile):
        return RecommendationSet(items=[], modelVersion=MODEL_VERSION, generatedAt=generated_at)

    profile /= total_strength
    content_scores = cosine_similarity(profile.reshape(1, -1), matrix)[0]
    affinity = _category_affinity(request.products, strengths)
    category_scores = np.array(
        [affinity.get(str(product.categoryId), 0.0) for product in request.products],
        dtype=float,
    )
    scores = (
        PERSONALIZED_CONTENT_WEIGHT * content_scores
        + PERSONALIZED_CATEGORY_WEIGHT * category_scores
    )
    return RecommendationSet(
        items=_rank(request.products, scores, request.limit),
        modelVersion=MODEL_VERSION,
        generatedAt=generated_at,
    )


def similar_product_recommendations(request: SimilarRecommendationRequest) -> RecommendationSet:
    generated_at = datetime.now(timezone.utc)
    if len(request.products) < 2:
        return RecommendationSet(items=[], modelVersion=MODEL_VERSION, generatedAt=generated_at)

    product_index = {str(product.productId): index for index, product in enumerate(request.products)}
    target_id = str(request.targetProductId)
    target_index = product_index.get(target_id)
    if target_index is None:
        return RecommendationSet(items=[], modelVersion=MODEL_VERSION, generatedAt=generated_at)

    matrix = _matrix(request.products)
    content_scores = cosine_similarity(matrix[target_index], matrix)[0]
    target_category = request.products[target_index].categoryId
    category_scores = np.array(
        [1.0 if product.categoryId == target_category else 0.0 for product in request.products],
        dtype=float,
    )
    scores = SIMILAR_CONTENT_WEIGHT * content_scores + SIMILAR_CATEGORY_WEIGHT * category_scores
    return RecommendationSet(
        items=_rank(request.products, scores, request.limit, exclude={target_id}),
        modelVersion=MODEL_VERSION,
        generatedAt=generated_at,
    )
