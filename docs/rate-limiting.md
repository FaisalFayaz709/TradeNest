# Rate limiting hardening

This capability implements the rate-limit hardening requirement from the TradeNest Technical Blueprint. The blueprint requires rate limiting but intentionally leaves exact numeric thresholds open; ADR-033 records the chosen baseline values.

## Authority boundary

Rate limiting is an API abuse-control layer only. It does not replace authentication, RBAC, ownership/policy checks, idempotency, provider-signature verification, or financial state-machine validation. A request that is under its rate limit must still satisfy every existing authorization and business rule.

NestJS owns all public rate limits. FastAPI remains internal-only and is not exposed to the browser.

## Policies

| Policy | Key | Limit |
|---|---|---:|
| Public registration | direct peer IP | 5 / 15 minutes |
| Login | direct peer IP | 20 / 5 minutes |
| Login | SHA-256(normalized email) | 8 / 5 minutes |
| Refresh | direct peer IP | 30 / 5 minutes |
| Change password | authenticated user | 5 / 15 minutes |
| Behavior-event ingestion | authenticated user, otherwise direct peer IP | 120 / minute |
| Personalized recommendations | authenticated user | 30 / minute |
| Similar-product recommendations | direct peer IP | 60 / minute |
| Smart pricing | authenticated seller | 20 / minute |
| Payment creation | authenticated buyer | 15 / 5 minutes |
| Invalid payment-webhook signatures | provider + direct peer IP | 30 / minute |

The login path deliberately applies both IP and account-identity buckets. The identity bucket stores only a SHA-256 digest of the normalized email value.

## Payment webhooks

Valid, provider-signed payment webhooks are **not** placed behind a blanket request-count limiter. Provider retry bursts are part of normal payment reliability, and duplicate verified events are already handled by idempotent payment processing.

Only attempts that fail provider signature verification consume `PAYMENT_WEBHOOK_INVALID_SIGNATURE_IP`. The first invalid attempts retain the existing `401 PAYMENT_WEBHOOK_SIGNATURE_INVALID` response; after the abuse threshold is exhausted, subsequent invalid attempts receive `429 RATE_LIMIT_EXCEEDED`. Valid signed events never consume that bucket.

## 429 response

Denied requests return the normal TradeNest error envelope with:

- HTTP `429`;
- error code `RATE_LIMIT_EXCEEDED`;
- policy identifier and `retryAfterSeconds` in error details;
- standard `Retry-After` response header.

No bucket key, user ID, email digest, or source IP is exposed in the response.

## Store and memory bound

This capability limiter is an in-process fixed-window store with a hard cap of 50,000 active buckets and opportunistic expiry pruning. Rate-limit state is operational/advisory and is not durable marketplace state, so this capability does not add a database model or migration.

This is correct for the current single NestJS runtime baseline. A future deployment that runs multiple API replicas must either keep a single effective limiter authority or introduce a shared limiter store as a deployment decision; the blueprint does not lock Redis or another distributed cache and this capability does not invent one.

## Client IP rule

The limiter uses Express `request.ip` / socket peer address and does not parse `X-Forwarded-For` directly. TradeNest does not enable blanket proxy trust in this document. If a later deployment sits behind a trusted reverse proxy, proxy trust must be configured narrowly for that deployment topology so untrusted clients cannot spoof limiter identities.
