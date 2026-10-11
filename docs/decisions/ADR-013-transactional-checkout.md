# ADR-013 — Transactional checkout coordination

**Status:** Accepted for this decision

## Context

The blueprint locks a single transactional checkout covering authoritative
product/seller/stock validation, inventory reservation, order snapshots, and a
payment intent/record. It also requires module ownership boundaries and
idempotency for financial writes.

## Decisions

1. OrdersModule coordinates checkout but modules retain ownership of their
   records.
2. A DatabaseTransactionService supplies an opaque transaction context that
   public module APIs can accept. Only repositories use the underlying Prisma
   transaction client.
3. Checkout runs at PostgreSQL serializable isolation with bounded retry for
   Prisma write-conflict code P2034.
4. Checkout input contains only `shippingAddressId`; all monetary/state values
   are backend-owned.
5. Shipping address data is copied into the Order JSONB field at checkout.
6. The order starts in `PENDING_PAYMENT`; the payment starts in `PENDING`.
7. No escrow row/state is created before verified payment success.
8. The checked-out cart is marked inactive in the same transaction. This is an
   implementation decision that prevents accidental reuse of the exact cart;
   it does not make cart data authoritative.
9. `Idempotency-Key` is mandatory. A hashed key and exact response are persisted
   atomically in `idempotency_records` with a unique `(user, operation, key)`
   boundary.
10. The pending payment record uses `INTERNAL_PENDING` plus an internal unique
    reference only because this decision schema requires non-null provider fields.
    This is not an external payment provider or a successful payment.

## Consequences

- Failure anywhere in checkout rolls back reservations and all created rows.
- Cross-module table writes remain forbidden.
- Checkout retries return the original response instead of creating duplicate
  orders/payments.
- this decision may assign a real payment provider through PaymentsModule without
  changing checkout authority or declaring client-side success.
