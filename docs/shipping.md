# TradeNest Shipping

This capability implements the blueprint shipment boundary only.

## HTTP API

- `POST /api/v1/orders/:id/shipment` — participating Seller only.
- `GET /api/v1/orders/:id/shipment` — participating Buyer or Seller.

## Creation policy

A new shipment requires all of the following:

1. authenticated `SELLER` role;
2. seller appears in the order's immutable order-item snapshots;
3. order state is `PAID` or `PROCESSING`;
4. escrow state is `HELD`;
5. no shipment already exists for the order through the application boundary.

Creation, `Order -> SHIPPED`, and `Escrow -> SELLER_SHIPPED` execute in the same serializable PostgreSQL transaction.

## Data contract

The client provides only `carrier` and `trackingCode`. Shipment status and timestamps are backend-owned. This capability stores `status = SHIPPED` and `shipped_at` at creation.

## Unspecified provider integrations

The blueprint does not specify a shipping carrier API, label-generation provider, shipping-rate engine, tracking webhook contract, or exact full shipment-status vocabulary. Those are not invented here. Buyer delivery confirmation and delivered-state transitions are implemented through the delivery-confirmation boundary.
