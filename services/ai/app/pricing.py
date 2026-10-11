from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal
from uuid import UUID

import numpy as np
import pandas as pd
from pydantic import BaseModel, ConfigDict, Field

MODEL_VERSION = "smart-pricing-mvp-v1"
MAX_PRICE = Decimal("99999999.00")
MIN_PRICE = Decimal("0.01")
CENT = Decimal("0.01")


class PricingProduct(BaseModel):
    model_config = ConfigDict(extra="forbid")

    productId: UUID
    sellerId: UUID
    categoryId: UUID
    currentPrice: str = Field(pattern=r"^\d{1,8}\.\d{2}$")
    currency: str = Field(pattern=r"^[A-Z]{3}$")


class ComparableProduct(BaseModel):
    model_config = ConfigDict(extra="forbid")

    productId: UUID
    price: str = Field(pattern=r"^\d{1,8}\.\d{2}$")
    currency: str = Field(pattern=r"^[A-Z]{3}$")


class PricingSignals(BaseModel):
    model_config = ConfigDict(extra="forbid")

    productViews: int = Field(ge=0)
    addToCartEvents: int = Field(ge=0)
    completedOrders: int = Field(ge=0)
    completedUnitsSold: int = Field(ge=0)


class SmartPricingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product: PricingProduct
    comparables: list[ComparableProduct] = Field(max_length=200)
    signals: PricingSignals


class SuggestedRange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    minPrice: str
    maxPrice: str


class PricingSignalSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    productViews: int
    addToCartEvents: int
    completedOrders: int
    completedUnitsSold: int
    conversionRatePercent: float | None
    comparableProductCount: int
    comparableMedianPrice: str | None


class SmartPricingSuggestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    productId: UUID
    currency: str
    currentPrice: str
    suggestedRange: SuggestedRange
    signals: PricingSignalSummary
    advisory: Literal[True] = True
    modelVersion: str
    generatedAt: datetime


def _money(value: Decimal) -> str:
    bounded = min(MAX_PRICE, max(MIN_PRICE, value))
    return f"{bounded.quantize(CENT, rounding=ROUND_HALF_UP):.2f}"


def smart_pricing_suggestion(request: SmartPricingRequest) -> SmartPricingSuggestion:
    current = Decimal(request.product.currentPrice)
    comparable_values = [
        Decimal(item.price)
        for item in request.comparables
        if item.currency == request.product.currency and item.productId != request.product.productId
    ]

    comparable_median: Decimal | None = None
    if comparable_values:
        # numpy/pandas remain part of the locked AI/data stack. The median is an
        # advisory statistical feature, not an authoritative transaction amount.
        frame = pd.DataFrame({"price": np.array([float(value) for value in comparable_values], dtype=float)})
        comparable_median = Decimal(str(float(np.median(frame["price"].to_numpy()))))

    views = request.signals.productViews
    add_to_cart = request.signals.addToCartEvents
    completed_orders = request.signals.completedOrders
    completed_units = request.signals.completedUnitsSold
    conversion = None if views == 0 else min(1.0, completed_orders / views)
    cart_rate = 0.0 if views == 0 else min(1.0, add_to_cart / views)

    reference = comparable_median if comparable_median is not None else current
    history_weight = min(1.0, completed_units / 20.0)
    current_weight = Decimal(str(0.5 + (0.3 * history_weight)))
    reference_weight = Decimal("1") - current_weight
    center = (current * current_weight) + (reference * reference_weight)

    # Demand can move the advisory midpoint upward by at most 10%. The range
    # itself remains deliberately wider than the adjustment to avoid implying
    # false precision from sparse marketplace data.
    demand_signal = min(1.0, ((conversion or 0.0) + cart_rate) / 2.0)
    demand_multiplier = Decimal(str(1.0 + (0.10 * demand_signal)))
    center *= demand_multiplier

    lower = center * Decimal("0.90")
    upper = center * Decimal("1.10")
    min_price = Decimal(_money(lower))
    max_price = Decimal(_money(upper))
    if max_price < min_price:
        max_price = min_price

    return SmartPricingSuggestion(
        productId=request.product.productId,
        currency=request.product.currency,
        currentPrice=_money(current),
        suggestedRange=SuggestedRange(minPrice=_money(min_price), maxPrice=_money(max_price)),
        signals=PricingSignalSummary(
            productViews=views,
            addToCartEvents=add_to_cart,
            completedOrders=completed_orders,
            completedUnitsSold=completed_units,
            conversionRatePercent=None if conversion is None else round(conversion * 100.0, 2),
            comparableProductCount=len(comparable_values),
            comparableMedianPrice=None if comparable_median is None else _money(comparable_median),
        ),
        advisory=True,
        modelVersion=MODEL_VERSION,
        generatedAt=datetime.now(timezone.utc),
    )
