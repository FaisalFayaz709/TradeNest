# ADR-022 — Dispute resolution boundary

## Status
Accepted for this decision.

## Context
The blueprint requires Buyer-opened disputes, participant/Admin reads, messages/evidence, an Escrow dispute branch, Admin resolution to `REFUND_BUYER` or `RELEASE_TO_SELLER`, transactional financial transitions, and audit logs. It exposes only a resolve command; it does not define a separate "start review" endpoint or a Dispute `UNDER_REVIEW` value.

## Decision
1. Keep `Dispute.status` as the existing `OPEN | RESOLVED` foundation.
2. Use the Escrow state machine for `DISPUTED -> UNDER_REVIEW -> RELEASED | REFUNDED`.
3. `POST /admin/disputes/:id/resolve` requires `Idempotency-Key` because either outcome is a financial transition.
4. Disputes coordinates Orders and Escrow only through their public module APIs.
5. Escrow owns payment-provider refund calls, ledger entries, and escrow financial audit records.
6. Disputes owns the final Dispute resolution record and `DISPUTE_RESOLUTION` audit record.
7. Evidence registration stores object-storage references; no storage vendor-specific API is invented in this document.

## Consequences
The blueprint lifecycle is represented without an unnecessary schema migration, financial resolution is retry-safe and audited, and the modular-monolith ownership rules remain intact.
