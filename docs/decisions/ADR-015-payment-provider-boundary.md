# ADR-015: Provider-neutral payment boundary with development sandbox

## Status
Accepted for this decision.

## Context
The TradeNest blueprint requires a payment provider, verified provider webhooks, amount/currency verification, idempotent financial writes, and an atomic payment-success transaction. It does not name a production gateway.

## Decision
Introduce a `PaymentProvider` interface and a development `sandbox` adapter. The sandbox adapter is selected from server configuration and is not exposed as a locked production choice.

A successful verified webhook is finalized inside one serializable PostgreSQL transaction across explicit module APIs:

1. PaymentsModule marks Payment `SUCCEEDED`.
2. OrdersModule marks Order `PAID`.
3. EscrowModule creates Escrow `HELD`.
4. EscrowModule appends one `HOLD` ledger entry.

Duplicate success events return an idempotent acknowledgement after observing the already-succeeded payment and do not execute the financial writes again.

## Consequences
- The browser cannot declare payment success.
- Production provider choice remains open.
- A minimal escrow HOLD operation is pulled forward because omitting it would violate the blueprint's atomic success rule.
- Escrow release/refund behavior uses the same provider-neutral boundary from its owning escrow workflows.

## Future production-provider note

The current `sandbox` adapter is local and side-effect-free, so provider initialization can execute inside the payment-creation transaction without network latency. A future external gateway adapter must preserve durable idempotency and module boundaries while avoiding long-lived database transactions around remote network calls; that orchestration must be documented in the production-provider ADR.
