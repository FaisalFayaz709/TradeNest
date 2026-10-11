# Transactional Checkout

## Blueprint basis

This document implements the write-side checkout transaction described in Technical
Blueprint section 8.4 and preserves the API/state conventions from sections 5,
7, 11, and 12.

The browser submits only an owned shipping-address identifier and an
`Idempotency-Key`. It does not submit authoritative prices, totals, inventory,
seller state, order status, payment status, or payment success.

## Transaction boundary

`POST /api/v1/checkout` executes inside a PostgreSQL serializable transaction:

1. Load the authenticated buyer's current active cart.
2. Load an owned shipping address and build an immutable address snapshot.
3. Reload each product through CatalogModule and require `ACTIVE` status.
4. Enforce the one-seller MVP rule and require that seller to be `ACTIVE`.
5. Require one currency for the order.
6. Recalculate unit/line/subtotal/shipping/discount/total values on the backend.
7. Reserve inventory with conditional atomic updates through CatalogModule.
8. Create `Order(status=PENDING_PAYMENT)` through OrdersRepository.
9. Create immutable OrderItem product-name/SKU/price snapshots.
10. Create `Payment(status=PENDING)` through PaymentsModule.
11. Mark the checked-out cart inactive through CartModule.
12. Store the exact response under the checkout Idempotency-Key.
13. Commit.

Any error rolls all steps back, including inventory reservations.

## Module ownership

OrdersModule coordinates the use case but does not directly write Cart,
Inventory, Address, SellerProfile, or Payment records. An opaque
`DatabaseTransactionContext` is passed through public module seams so every
module continues to own its own persistence while participating in the same
PostgreSQL transaction.

## Money

Authoritative arithmetic uses integer minor units (`bigint`) in application
logic and PostgreSQL `NUMERIC/DECIMAL` for persistence. The browser never
supplies a trusted final price or total.

This capability pricing-policy decision remains unchanged: shipping and discount
adjustments are currently zero until explicit business rules are selected.

## Payment boundary

This capability creates only a durable `PENDING` payment record. It does not declare a
provider payment successful and does not create escrow. Because the current
foundation schema requires provider identifiers, the pre-provider record uses
`INTERNAL_PENDING` and an internal unique reference. External provider intent
creation/assignment remains the payment abstraction.

## Idempotency

Checkout is already a financial write, so the API-convention requirement for
`Idempotency-Key` is enforced now rather than exposing a retry-unsafe endpoint.
The raw key is not persisted. A SHA-256 hash is stored with the user, operation,
and exact original response under a unique database constraint. Concurrent
retries therefore cannot create a second committed checkout.

This capability may generalize this infrastructure for payment/refund/release commands;
it must not weaken checkout's existing idempotency guarantee.
