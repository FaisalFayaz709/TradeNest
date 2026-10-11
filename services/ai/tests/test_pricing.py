from uuid import UUID

from app.pricing import (
    ComparableProduct,
    PricingProduct,
    PricingSignals,
    SmartPricingRequest,
    smart_pricing_suggestion,
)

PRODUCT = UUID("30000000-0000-4000-8000-000000000001")
SELLER = UUID("30000000-0000-4000-8000-000000000002")
CATEGORY = UUID("30000000-0000-4000-8000-000000000003")


def request(*, current: str = "100.00", comparables: list[str] | None = None, views: int = 100, carts: int = 10, orders: int = 5, units: int = 8) -> SmartPricingRequest:
    values = comparables if comparables is not None else ["90.00", "110.00", "120.00"]
    return SmartPricingRequest(
        product=PricingProduct(productId=PRODUCT, sellerId=SELLER, categoryId=CATEGORY, currentPrice=current, currency="USD"),
        comparables=[ComparableProduct(productId=UUID(f"40000000-0000-4000-8000-{i:012d}"), price=value, currency="USD") for i, value in enumerate(values, 1)],
        signals=PricingSignals(productViews=views, addToCartEvents=carts, completedOrders=orders, completedUnitsSold=units),
    )


def test_pricing_returns_advisory_range_and_signal_summary() -> None:
    result = smart_pricing_suggestion(request())
    assert result.modelVersion == "smart-pricing-mvp-v1"
    assert result.advisory is True
    assert float(result.suggestedRange.minPrice) <= float(result.suggestedRange.maxPrice)
    assert result.signals.comparableProductCount == 3
    assert result.signals.comparableMedianPrice == "110.00"
    assert result.signals.conversionRatePercent == 5.0


def test_no_comparables_falls_back_to_current_price_context() -> None:
    result = smart_pricing_suggestion(request(comparables=[], views=0, carts=0, orders=0, units=0))
    assert result.signals.comparableProductCount == 0
    assert result.signals.comparableMedianPrice is None
    assert result.signals.conversionRatePercent is None
    assert result.currentPrice == "100.00"


def test_suggestion_never_exceeds_locked_product_price_ceiling() -> None:
    result = smart_pricing_suggestion(request(current="99999999.00", comparables=["99999999.00"], views=1, carts=1, orders=1, units=100))
    assert float(result.suggestedRange.maxPrice) <= 99999999.00


def test_fastapi_internal_pricing_route_is_registered() -> None:
    from app.main import app

    paths = {route.path for route in app.routes}
    assert "/internal/pricing/suggest" in paths
