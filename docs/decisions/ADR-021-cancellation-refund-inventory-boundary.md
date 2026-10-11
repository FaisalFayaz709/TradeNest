# ADR-021 — Cancellation, Refund, and Inventory Finalization Boundary

- **Status:** Accepted for this decision
- **Blueprint compatibility:** Implementation decision within locked business rules

## Decision

1. Pre-payment cancellation is the only path that restores checkout reservations automatically.
2. A provider-verified successful payment consumes the OrderItem inventory reservations atomically with the Payment/Order/Escrow success transaction.
3. Financial refund does not automatically restock inventory because the blueprint does not define returns inspection/restock semantics.
4. Post-capture reversal remains the existing Escrow refund command, protected by financial idempotency, provider refund idempotency, row locking, ledger entry, Order transition, and audit logging.

## Rationale

Without reservation consumption on verified payment, successful sales would leave `reserved_quantity` stranded. Automatically restocking on refund would invent a physical returns policy not specified by the blueprint. This decision cleanly separates inventory commitment from later returns/restocking while preserving the required cancellation/refund distinction.
