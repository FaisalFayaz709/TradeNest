from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.recommendations import (
    BehaviorSignal,
    PersonalizedRecommendationRequest,
    ProductFeature,
    SimilarRecommendationRequest,
    personalized_recommendations,
    similar_product_recommendations,
)

P1 = UUID("10000000-0000-4000-8000-000000000001")
P2 = UUID("10000000-0000-4000-8000-000000000002")
P3 = UUID("10000000-0000-4000-8000-000000000003")
P4 = UUID("10000000-0000-4000-8000-000000000004")
P5 = UUID("10000000-0000-4000-8000-000000000005")
C1 = UUID("20000000-0000-4000-8000-000000000001")
C2 = UUID("20000000-0000-4000-8000-000000000002")
NOW = datetime(2026, 10, 6, tzinfo=timezone.utc)


def products() -> list[ProductFeature]:
    return [
        ProductFeature(productId=P1, categoryId=C1, name="Mechanical Keyboard", description="compact keyboard tactile switches"),
        ProductFeature(productId=P2, categoryId=C1, name="Gaming Keyboard", description="keyboard tactile switches rgb"),
        ProductFeature(productId=P3, categoryId=C2, name="Ceramic Mug", description="coffee mug kitchen ceramic"),
        ProductFeature(productId=P4, categoryId=C2, name="Coffee Cup", description="coffee mug ceramic cup"),
    ]


def test_personalized_profile_prefers_similar_category() -> None:
    request = PersonalizedRecommendationRequest(
        events=[BehaviorSignal(productId=P1, eventType="PURCHASE", occurredAt=NOW)],
        products=products(),
        limit=4,
    )
    result = personalized_recommendations(request)
    assert result.modelVersion == "recommendation-hybrid-v2"
    assert result.items
    scores = {item.productId: item.score for item in result.items}
    assert scores[P2] > scores.get(P3, 0.0)


def test_similar_products_excludes_target_and_uses_category_signal() -> None:
    result = similar_product_recommendations(
        SimilarRecommendationRequest(targetProductId=P1, products=products(), limit=3)
    )
    assert all(item.productId != P1 for item in result.items)
    assert result.items[0].productId == P2
    scores = {item.productId: item.score for item in result.items}
    assert scores[P2] > scores.get(P3, 0.0)


def test_cold_start_returns_empty_instead_of_inventing_preferences() -> None:
    result = personalized_recommendations(
        PersonalizedRecommendationRequest(events=[], products=products(), limit=10)
    )
    assert result.items == []


def test_recent_behavior_can_outweigh_stale_high_intent_behavior() -> None:
    result = personalized_recommendations(
        PersonalizedRecommendationRequest(
            events=[
                BehaviorSignal(productId=P1, eventType="PURCHASE", occurredAt=NOW - timedelta(days=180)),
                BehaviorSignal(productId=P3, eventType="WISHLIST", occurredAt=NOW),
            ],
            products=products(),
            limit=4,
        )
    )
    scores = {item.productId: item.score for item in result.items}
    assert scores[P4] > scores[P2]


def test_repeated_views_saturate_below_single_purchase_intent() -> None:
    events = [
        BehaviorSignal(productId=P1, eventType="PRODUCT_VIEW", occurredAt=NOW)
        for _ in range(100)
    ]
    events.append(BehaviorSignal(productId=P3, eventType="PURCHASE", occurredAt=NOW))
    result = personalized_recommendations(
        PersonalizedRecommendationRequest(events=events, products=products(), limit=4)
    )
    scores = {item.productId: item.score for item in result.items}
    assert scores[P4] > scores[P2]


def test_similar_ranking_is_deterministic_for_equal_candidates() -> None:
    equal_products = [
        ProductFeature(productId=P1, categoryId=C1, name="Keyboard", description="wired keyboard"),
        ProductFeature(productId=P2, categoryId=C1, name="Keyboard", description="wired keyboard"),
        ProductFeature(productId=P5, categoryId=C1, name="Keyboard", description="wired keyboard"),
    ]
    result = similar_product_recommendations(
        SimilarRecommendationRequest(targetProductId=P1, products=equal_products, limit=2)
    )
    assert [item.productId for item in result.items] == [P2, P5]


def test_unknown_event_product_is_ignored_without_cold_start_fallback() -> None:
    unknown = UUID("10000000-0000-4000-8000-000000000099")
    result = personalized_recommendations(
        PersonalizedRecommendationRequest(
            events=[BehaviorSignal(productId=unknown, eventType="PURCHASE", occurredAt=NOW)],
            products=products(),
            limit=10,
        )
    )
    assert result.items == []


def test_internal_request_contract_rejects_extra_model_controls() -> None:
    with pytest.raises(ValidationError):
        PersonalizedRecommendationRequest.model_validate(
            {
                "events": [],
                "products": [],
                "limit": 10,
                "categoryWeight": 0.99,
            }
        )


def test_fastapi_internal_routes_are_registered() -> None:
    from app.main import app

    paths = {route.path for route in app.routes}
    assert "/internal/recommendations/personalized" in paths
    assert "/internal/recommendations/similar" in paths
