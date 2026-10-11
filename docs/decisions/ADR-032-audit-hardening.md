# ADR-032: Audit hardening without a new audit subsystem

## Status

Accepted in this decision.

## Context

The blueprint requires audit logs for refunds, escrow releases, dispute resolutions, suspensions, and other sensitive Admin actions. TradeNest already has an `audit_logs` table and transaction-bound audit writes for implemented financial/dispute commands, but request correlation was inconsistent: errors generated request IDs while successful requests did not always have one, and service cleaners allowed values wider than the database column. A general-purpose logging/event platform would be premature and would duplicate the modular-monolith audit boundary.

## Decision

1. Install one global NestJS request-ID middleware before controllers.
2. Preserve only safe caller IDs up to 128 characters; otherwise generate a UUID.
3. Return the canonical ID on every HTTP response and make it available to existing audited controllers through the request headers.
4. Make `AuditService` the normalization/privacy boundary for audit JSON and request IDs.
5. Keep required refund/release/dispute audit inserts inside the same database transaction as the protected state transition.
6. Keep audit persistence append-only at the application API: only `AuditRepository.create` is permitted; no update/delete/upsert path is introduced.
7. Do not add a new Prisma model, migration, queue, log service, or separate audit microservice.

## Consequences

Sensitive financial/Admin transitions remain traceable to actor, target, before/after state, decision metadata, and request correlation. Credential-like fields are defensively redacted before persistence. Required audit failure remains a transaction failure instead of a silent omission. Future suspension/admin commands must reuse this boundary.
