# ADR-014 — Single-seller checkout invariant hardening

**Status:** Accepted for this decision

## Context

The blueprint recommends restricting MVP checkout to one seller per order, then
later evolving to a parent-order model with seller sub-orders. The quote and checkout implementations
already enforce one seller in the checkout coordinator.

A future refactor could accidentally bypass that coordinator and create a mixed-
seller order directly through OrdersRepository. This decision adds defense in depth
without changing the domain schema.

## Decisions

1. `CheckoutService` remains the public business-policy enforcement point for
   mixed-seller cart rejection.
2. The existing API error remains HTTP 409 with code
   `MULTI_SELLER_CHECKOUT_NOT_SUPPORTED`.
3. Both quote and write checkout must enforce the invariant before seller
   activation checks or any checkout writes.
4. `OrdersRepository.createPendingPaymentOrder` independently asserts that all
   item snapshots share exactly one seller ID before invoking Prisma.
5. The database schema and migrations are unchanged in this decision.
6. No parent-order, sub-order, split-shipment, split-settlement, or split-escrow
   design is introduced.

## Consequences

- Mixed-seller carts cannot become MVP orders through the supported checkout
  path.
- A future internal caller also cannot persist mixed-seller OrderItem snapshots
  through the existing OrdersRepository create method.
- The future multi-seller design will require an explicit architecture decision
  rather than emerging accidentally through relaxed checks.
