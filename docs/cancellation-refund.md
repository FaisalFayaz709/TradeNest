# Cancellation and Refund Boundary

## Blueprint-derived rules

- Before successful payment, an eligible Buyer cancellation may set the Order to `CANCELLED` and release reserved inventory.
- After funds are captured/held, cancellation is a refund workflow rather than a simple status change.
- Refund/release financial writes are transactional, idempotent, audited, and ledger-backed.
- Clients do not PATCH authoritative Order/Payment/Escrow state directly.

## Implemented boundary

### Pre-payment cancellation

`POST /orders/:id/cancel` remains Buyer-only and `PENDING_PAYMENT`-only. The Order row is locked. An already-initialized external pending payment blocks local cancellation. A succeeded payment can never be cancelled. Successful cancellation sets `Order = CANCELLED` and releases each inventory reservation in the same serializable PostgreSQL transaction. Repeated cancellation is a no-op response and does not release stock twice.

### Verified payment inventory finalization

Checkout reserves inventory. This capability finalizes those reservations only when a provider-verified payment success is accepted. The Payment success transaction now obtains immutable OrderItem product/quantity commitments through OrdersModule and asks CatalogModule to consume each reservation. Payment success, `Order = PAID`, inventory reservation consumption, `Escrow = HELD`, and the HOLD ledger therefore commit or roll back together.

### Post-capture refund

`POST /escrows/:id/refund` remains an Admin/internal financial command. It requires a financial idempotency key, locks Escrow, validates the coupled Order/Escrow state, invokes the provider-neutral idempotent refund, then writes `Escrow = REFUNDED`, a REFUND ledger entry, `Order = REFUNDED`, audit history, and the original idempotency response.

## Inventory-restock decision

The blueprint does not define returned-goods inspection or automatic restocking after a captured-payment refund. This capability therefore does **not** automatically increase `available_quantity` on refund. Inventory is finalized as sold on verified payment success; any later restock requires an explicit future inventory/returns policy. This avoids silently treating a financial refund as proof that physical goods are saleable again.

## Forbidden flows

- `PAID`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `COMPLETED`, `DISPUTED`, or `REFUNDED` → `CANCELLED`
- Buyer/browser declaring a refund successful
- refund without Idempotency-Key
- refund without provider operation + Escrow ledger/audit transition
- refund automatically restocking inventory without an explicit returns policy
