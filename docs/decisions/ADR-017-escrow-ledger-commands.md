# ADR-017: Escrow ledger command boundary

## Status
Accepted for this decision.

## Context
The blueprint requires separate Order/Payment/Escrow state machines, command-style release/refund endpoints, ledger entries, idempotent financial writes, and audit records for release/refund decisions.

## Decision
EscrowModule owns escrow lifecycle state and ledger entries. HTTP release/refund commands are Admin-only; other domain modules use the explicit EscrowModule API for internal transitions.

Release/refund commands use `FinancialIdempotencyService`, a serializable PostgreSQL transaction, and a row-level escrow lock. Refund validates the coupled order state and locks the escrow before invoking the provider-neutral refund seam, preventing distinct idempotency keys from issuing concurrent refunds.

A release commits Escrow `RELEASED` + RELEASE ledger + Order `COMPLETED` + audit atomically. A refund calls the provider idempotently, then commits Escrow `REFUNDED` + REFUND ledger + Order `REFUNDED` + audit atomically.

## Consequences
- No arbitrary escrow-status PATCH exists.
- Duplicate same-key commands replay the original response.
- Different-key concurrent refunds serialize on the escrow row.
- The production payment provider remains open.
- No new persistence model or migration is required in this decision.
