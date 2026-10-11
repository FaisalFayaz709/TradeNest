# Escrow and Ledger

## Blueprint-derived scope

Implemented API surface:

- `GET /api/v1/orders/:id/escrow` — Buyer/Seller participant/Admin.
- `POST /api/v1/escrows/:id/release` — Internal/Admin command; HTTP surface is Admin-only.
- `POST /api/v1/escrows/:id/refund` — Internal/Admin command; HTTP surface is Admin-only.

Escrow remains a state machine separate from Order and Payment:

`PENDING -> HELD -> SELLER_SHIPPED -> BUYER_CONFIRMED -> RELEASED`

Dispute path:

`HELD|SELLER_SHIPPED -> DISPUTED -> UNDER_REVIEW -> RELEASED|REFUNDED`

The cancellation rule also requires a captured/held payment to use a refund workflow rather than a simple order-status change. For that reason this capability refund command permits `HELD -> REFUNDED` only when the coupled Order is still `PAID` or `PROCESSING`. Dispute refund is permitted from `UNDER_REVIEW` only when the Order is `DISPUTED`.

## Financial-transition rules

Release:

- requires Admin at the HTTP command boundary;
- requires `Idempotency-Key`;
- locks the escrow row;
- accepts only `BUYER_CONFIRMED` + `DELIVERED`, or `UNDER_REVIEW` + `DISPUTED`;
- writes `Escrow = RELEASED` and one `RELEASE` ledger entry;
- moves the Order to `COMPLETED` through OrdersModule;
- writes an audit log in the same database transaction.

Refund:

- requires Admin at the HTTP command boundary;
- requires `Idempotency-Key`;
- locks the escrow row before provider refund;
- accepts only `HELD` + (`PAID` or `PROCESSING`), or `UNDER_REVIEW` + `DISPUTED`;
- invokes the provider-neutral PaymentsModule refund seam with the same idempotency key;
- writes `Escrow = REFUNDED` and one `REFUND` ledger entry;
- moves the Order to `REFUNDED` through OrdersModule;
- writes an audit log in the same database transaction.

The payment row remains `SUCCEEDED`; the locked PaymentStatus enum does not define `REFUNDED`. Refund truth is represented by the provider refund reference, Escrow state/ledger, Order state, and audit history rather than inventing a new payment status.

## Module boundaries

- EscrowRepository mutates only Escrow and EscrowTransaction records.
- OrdersRepository mutates only Order records.
- PaymentsModule owns the external payment provider/refund adapter.
- AuditService owns AuditLog writes.
- EscrowCommandsService coordinates these explicit public seams under one serializable transaction.

No controller accesses Prisma.

## Provider decision

The production gateway remains unspecified by the blueprint. The development sandbox now implements deterministic idempotent refunds; a production adapter must provide the same idempotent refund contract.

## Deferred

Shipping, buyer delivery confirmation, cancellation/refund, and dispute resolution are owned by their dedicated modules and reuse the escrow boundary. Automatic release timing remains an explicit product/deployment decision unless separately configured.
