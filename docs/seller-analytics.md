# Seller analytics

This capability implements the blueprint seller analytics endpoint:

- `GET /api/v1/seller/analytics` — authenticated SELLER only.

The endpoint is owned by `AnalyticsModule`. It is a read-only analytical projection over authoritative marketplace records; it never mutates Orders, Products, Inventory, Escrow, Payments, or AI state.

## KPI semantics

The blueprint names revenue, order count, products sold, average order value, conversion rate, top products, low-stock products, order-status distribution, and escrow visibility, but it does not define formulas, date ranges, FX conversion, or low-stock thresholds. This capability adopts the following explicit MVP decisions:

- **Revenue** is the exact escrow amount already in `RELEASED`, grouped by order currency. This avoids treating held/disputed/refunded funds as earned revenue.
- **Average order value** is the average released escrow amount, grouped by currency.
- **Order count** is all seller-participating orders across statuses.
- **Products sold** is the quantity of the seller's immutable order items on `COMPLETED` orders.
- **Conversion rate** is `COMPLETED seller orders / recorded PRODUCT_VIEW events for seller products * 100`. It is behavioral telemetry, not financial authority, and is `null` when no view denominator exists.
- **Top products** are the five products with the most completed units sold. Their revenue remains grouped by order currency.
- **Low stock** means an `ACTIVE` seller product whose current `available_quantity` is at or below `SELLER_ANALYTICS_LOW_STOCK_THRESHOLD` (default `5`). The response includes the threshold so the interpretation is visible.
- **Order-status distribution** counts the seller's orders by authoritative Order status.
- **Escrow visibility** groups escrow count and exact amount by Escrow status and order currency.

All metrics are all-time in this MVP because the blueprint does not define an analytics date-range query contract.

## Multi-currency rule

TradeNest does not define an FX-rate provider or base reporting currency. Money values are therefore returned as exact decimal strings grouped by their original three-letter currency code. This capability never adds USD, PKR, EUR, or other currencies into a synthetic single revenue amount.

## Module boundary

`AnalyticsRepository` is the only Analytics class that uses Prisma. For seller analytics it performs read-only SQL projections across Orders, OrderItems, Products, Inventory, UserEvents, and Escrow. This is an analytics read model only: it contains no cross-domain write methods. The owning modules remain authoritative for business validation and state transitions.

The service also calls `SellerModuleApi.requireSellerProfile()` to require an onboarded seller identity. It deliberately does not require `ACTIVE` status for read-only analytics because the blueprint only locks ACTIVE status for seller business actions such as product creation.

## AI separation

This capability returns authoritative marketplace metrics only. It does not call FastAPI and does not mix AI-generated recommendations, pricing suggestions, or fraud scores into these fields. The blueprint's teal AI visual language remains a presentation concern for the Seller UI/AI-insight surface.
