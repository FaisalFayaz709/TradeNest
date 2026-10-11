# Behavior Event Ingestion

This capability activates the blueprint's first Intelligence capability: `POST /api/v1/events` behavior-event ingestion.

## Supported signals

The locked behavior vocabulary already exists in PostgreSQL/Prisma:

- `PRODUCT_VIEW`
- `WISHLIST`
- `ADD_TO_CART`
- `PURCHASE`

The public request contains only `eventType` and `productId`. The browser cannot submit `userId`, `occurredAt`, model score/weight, price, stock, or arbitrary metadata.

## Identity

The endpoint permits anonymous behavior events because the locked `user_events.user_id` column is nullable. If no Authorization header is sent, `user_id` is stored as `NULL`. If a Bearer token is supplied, it must be valid and the authenticated principal's user ID is attached by NestJS. A malformed or invalid supplied token is not silently ignored.

## Product boundary

Analytics does not query Product persistence. It calls `CatalogModuleApi.requireBehaviorEventProduct(productId)`, which requires an existing `ACTIVE` public product. This keeps Catalog authoritative for product visibility.

## Authority and trust

Behavior events are advisory recommendation signals only. They never mutate Product, Cart, Order, Payment, Escrow, Inventory, or Wishlist state and never prove that a financial action occurred. The `PURCHASE` event name is a recommendation signal in this endpoint, not payment authority; verified payment remains exclusively provider/backend controlled.

## FastAPI boundary

This capability stores events in PostgreSQL through NestJS. It does not activate recommendation ranking or call FastAPI. Later recommendation work may have NestJS call FastAPI internally; the browser must never call FastAPI directly.

## Persistence

`AnalyticsRepository` is the only AnalyticsModule class that uses Prisma. It writes to the existing `user_events` table. No schema change or migration is required.
