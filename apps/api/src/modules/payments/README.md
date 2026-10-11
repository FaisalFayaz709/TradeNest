# PaymentsModule

This module implements the provider-neutral payment boundary required by the TradeNest blueprint.

Implemented API:

- `POST /api/v1/orders/:orderId/payments` — BUYER, idempotent provider initialization
- `GET /api/v1/payments/:id` — payment owner or ADMIN
- `POST /api/v1/payments/webhooks/:provider` — provider-signed webhook boundary

The development provider is an HMAC-signed `sandbox` adapter because the blueprint does not lock a production gateway. The adapter is explicitly an implementation decision and can be replaced behind the `PaymentProvider` interface.

A verified successful provider event is finalized atomically as:

`Payment = SUCCEEDED` + `Order = PAID` + `Escrow = HELD` + one escrow `HOLD` ledger entry.

The browser can never declare payment success. Refund and escrow-release workflows are coordinated through their owning backend modules.


This module adds best-effort fraud assessment after non-duplicate terminal provider webhooks. This happens after the authoritative financial transaction commits and is caught/logged on failure, so FastAPI availability cannot change payment correctness or acknowledgement.
