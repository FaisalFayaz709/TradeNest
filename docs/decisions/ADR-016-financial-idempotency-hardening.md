# ADR-016 — Financial idempotency hardening

**Status:** Accepted for this decision

## Context
The blueprint requires financial writes to support an Idempotency-Key and return the original result on retry. Checkout and payment creation already use durable retry keys. A raw key alone, however, cannot distinguish a legitimate retry from accidental reuse of the same key for a different request.

## Decision
Use one shared `FinancialIdempotencyService` for financial writes. Persist a SHA-256 `request_hash` beside the existing hashed key and original response. Reject a reused key with a different request fingerprint using `409 IDEMPOTENCY_KEY_REUSED`.

The new column is nullable solely for migration compatibility with records created before this decision. New writes always populate it.

## Blueprint classification
The requirement for idempotent financial writes is LOCKED. Request fingerprinting, canonical JSON, SHA-256 key hashing, and the migration-compatibility strategy are ALLOWED IMPLEMENTATION DECISIONS that strengthen the locked behavior without changing the public financial state machines.

## Deferred
Refund and escrow release reuse this same idempotency service rather than introducing a parallel retry mechanism.
