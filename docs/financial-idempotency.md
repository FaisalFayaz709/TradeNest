# Financial idempotency

## Blueprint requirement

Financial write operations support `Idempotency-Key`. The durable identity is user + operation + key, and a retry returns the original response instead of creating another order/payment/refund/release.

## hardening

TradeNest now routes financial idempotency through `FinancialIdempotencyService`. Business services do not use the persistence repository directly. Every new record also stores a SHA-256 request fingerprint.

- Same user + operation + key + same request intent: replay the exact original response.
- Same user + operation + key + different request intent: `409 IDEMPOTENCY_KEY_REUSED`.
- Key values are stored only as SHA-256 hashes.
- New request fingerprints are SHA-256 hashes of canonical JSON; raw request bodies are not stored in the idempotency table.
- The database unique key remains `(user_id, operation, key_hash)`.
- Legacy records created before this capability may have a NULL request fingerprint and remain replayable. Every new record has a fingerprint.

## Current operations

- `CHECKOUT_CREATE`
- `PAYMENT_CREATE:<orderId>`

Refund and escrow-release operations reuse this same idempotency boundary rather than introducing a parallel mechanism.

## Concurrency

Checkout and payment creation still use SERIALIZABLE PostgreSQL transactions. A new request first inserts an uncommitted idempotency claim inside the SERIALIZABLE transaction, before inventory/order/payment-provider side effects. Concurrent requests with the same key therefore serialize at the database unique key. The winner completes the claim with the original response before COMMIT; the loser then replays that response (or receives `IDEMPOTENCY_KEY_REUSED` when its request fingerprint differs). External payment-provider creation also receives the same client idempotency key.
