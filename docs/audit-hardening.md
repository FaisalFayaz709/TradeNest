# Audit hardening

This capability hardens the blueprint requirement that refunds, escrow releases, dispute resolutions, suspensions, and other sensitive Admin actions have durable audit history.

## Scope

This document does not add new Admin business commands. It hardens the audit path already used by the implemented sensitive financial/Admin commands:

- `ESCROW_RELEASE`;
- `ESCROW_REFUND`;
- `DISPUTE_RESOLUTION`;
- buyer-confirmation escrow release, which is recorded as `ESCROW_RELEASE` with cause `BUYER_CONFIRM_DELIVERY`.

Future suspension/admin commands must use the same `AuditService` boundary when they are implemented.

## Request correlation

Every NestJS HTTP request now receives one canonical `x-request-id` before controllers execute. A caller-supplied ID is preserved only when it is a safe, non-whitespace identifier of at most 128 characters. Otherwise the backend generates a UUID. The same ID is returned on successful responses and error responses.

The 128-character limit matches `audit_logs.request_id VARCHAR(128)`. This removes the prior mismatch where service-level cleaners could retain up to 255 characters.

## Sensitive-data minimization

`AuditService` is the mandatory normalization layer before audit persistence. It:

- validates the action and entity-type vocabulary shape;
- caps request IDs to the database width;
- recursively redacts credential-like keys such as passwords, access/refresh tokens, authorization headers, cookies, API keys, client secrets, raw request bodies, and signatures;
- keeps provider transaction references, entity IDs, state transitions, and decision metadata available for traceability.

Audit entries are not an alternate secrets store.

## Transactional integrity

Required audit rows are written through `AuditRepository` using the same `DatabaseTransactionContext` as the sensitive state transition. The application has no audit update/delete command path.

For refund, release, and dispute resolution, audit persistence is fail-closed: if the required audit insert fails, the surrounding business transaction must roll back. Audit is not dispatched as best-effort background work for these required actions.

## Database boundary

This capability intentionally adds no schema or migration. The locked `audit_logs` table already contains actor, action, target entity, before/after JSON, metadata, request ID, and timestamp fields. Database integration coverage now verifies structured writes, transaction rollback, and the `VARCHAR(128)` request-ID boundary.
