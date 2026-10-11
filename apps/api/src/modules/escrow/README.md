# EscrowModule

Owns escrow lifecycle state and escrow ledger writes.

Implemented public HTTP surface:

- `GET /api/v1/orders/:orderId/escrow` — Buyer/Seller participant or Admin.
- `POST /api/v1/escrows/:id/release` — Admin command, requires `Idempotency-Key`.
- `POST /api/v1/escrows/:id/refund` — Admin command, requires `Idempotency-Key`.

The internal module seam also exposes state transitions used by Shipping, Delivery, and Dispute workflows:

- `HELD -> SELLER_SHIPPED`
- `SELLER_SHIPPED -> BUYER_CONFIRMED`
- `HELD|SELLER_SHIPPED -> DISPUTED`
- `DISPUTED -> UNDER_REVIEW`

Release is valid only from `BUYER_CONFIRMED` or `UNDER_REVIEW`.
Refund is valid only from `HELD` (captured/held cancellation workflow foundation) or `UNDER_REVIEW` (dispute workflow).

Every release/refund is transactional, ledger-backed, idempotent, and audited. Refund additionally invokes the Payments module's provider-neutral idempotent refund seam before local financial state commits.
