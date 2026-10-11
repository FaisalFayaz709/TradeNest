# ADR-027 — Seller analytics is a read-only cross-domain projection

## Context

The blueprint assigns seller analytics to the Analytics module and requires revenue, order count, products sold, AOV, conversion, top products, low stock, order-status distribution, and escrow visibility. These facts live across multiple authoritative modules. The architecture forbids opportunistic cross-module mutation, but analytics inherently needs a joined read view.

## Decision

`AnalyticsRepository` may perform read-only PostgreSQL projections across marketplace tables for seller analytics. It may not update or delete records owned by other modules. Business state transitions continue to go through the owning module APIs.

Financial amounts remain exact PostgreSQL numeric values serialized as decimal strings. Amounts are grouped by currency because no FX conversion mechanism is locked.

Revenue means released escrow, not gross checkout value. Top-product sales and units use completed orders. Conversion is an explicitly advisory behavioral KPI based on completed orders divided by recorded product-view events.

Low-stock threshold is server configuration (`SELLER_ANALYTICS_LOW_STOCK_THRESHOLD`, default 5), never a client-owned authority.

## Consequences

- Analytics queries stay efficient and avoid creating a large set of cross-module aggregation APIs.
- Orders/Catalog/Escrow remain the only owners of mutation and business state transitions.
- No new schema or migration is required.
- Multi-currency sellers receive separate monetary buckets rather than a misleading blended amount.
- AI seller insights remain separate from authoritative analytics values.
