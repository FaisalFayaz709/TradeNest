# ADR-033 — Rate limiting hardening

## Status
Accepted in this decision.

## Context

The TradeNest the Blueprint workstream requires rate limits but explicitly leaves exact values open for an ADR. TradeNest also locks provider-verified payment success, financial idempotency, NestJS as the browser-facing backend, and FastAPI as an internal ML service.

A hardening solution must therefore reduce brute force, event spam, expensive AI traffic, and payment-initiation abuse without allowing the limiter to become a substitute for authorization or a reliability hazard for legitimate payment-provider retries.

## Decision

Use a NestJS-owned fixed-window limiter with explicit named policies and a bounded in-memory store.

Chosen baseline thresholds are documented in `docs/rate-limiting.md` and codified in `RATE_LIMIT_POLICIES`.

Keying rules:

- unauthenticated public entry points use the direct peer IP;
- login applies both an IP bucket and a SHA-256-normalized-email bucket;
- authenticated operations use the server-authenticated `userId` where available;
- optional-auth behavior events use authenticated `userId`, otherwise the direct peer IP;
- no limiter code reads `X-Forwarded-For` directly.

Payment-provider webhooks are not blanket-throttled. Provider signature verification runs first. Only invalid-signature attempts consume the webhook abuse bucket. Verified webhook retries remain governed by the existing idempotent payment-processing rules.

The limiter returns `429 RATE_LIMIT_EXCEEDED` with `Retry-After` and never exposes internal bucket identities.

## Consequences

- No new database model or migration is required.
- Rate-limit state resets with the NestJS process and is local to one process.
- Multi-replica deployment requires a later deployment decision for a single/shared limiter authority; no unapproved Redis dependency is introduced here.
- Exact thresholds are now an implementation baseline and may be tuned only through a reviewed ADR/change, not silently in feature code.
- Provider webhook reliability remains prioritized over blanket request throttling.
