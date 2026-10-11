
> **Financial remediation security override:** The post-audit remediation disables NEW `sk_live_` charges and ALL Stripe provider refunds until Financial reconciliation implements durable provider effects and reconciliation. Do not assume the earlier Payments refund adapter is active or production-safe. The original sandbox flows remain enabled. See [`risk-remediation.md`](risk-remediation.md).

# Payments — Stripe hosted Checkout integration

## Scope and compliance

This pass extends the **existing NestJS Payments module's PaymentProvider interface** with `StripeCheckoutProvider`. It does not create a separate financial service, change the stack, expose FastAPI, or let Next.js set Order/Payment/Escrow statuses. The existing sandbox provider remains default. The blueprint's 74 original routes are unchanged; Stripe receives signed events through the existing `POST /api/v1/payments/webhooks/stripe` endpoint.

Stripe is a **blueprint-permitted provider implementation choice**, not a newly locked vendor. Availability, currency, marketplace payout/escrow arrangements, and regulatory suitability must be confirmed for your launch jurisdiction before production activation. **A Stripe payment received by the platform is not automatically regulated escrow.** The system still has logical escrow accounting, not proven external custodial isolation or seller payouts.

## Implementation details

- Buyer invokes `POST /orders/:orderId/payments` with the existing required `Idempotency-Key` and receives `{payment, checkoutUrl?}`. For Stripe, Next.js checks an exact `https://checkout.stripe.com` host and redirects. Sandbox retains existing behavior.
- NestJS creates a Stripe hosted Checkout Session by an HTTPS request to Stripe's official API. Checkout amount, currency and order ID are constructed from authoritative backend state; server idempotency is derived from the immutable TradeNest payment ID, not browser-chosen body data.
- Stripe card Checkout only for the first implementation. Currency allowlist: `USD`, `EUR`, `GBP`, `CAD`, `AUD`, `NZD`, `SGD`, `CHF`, all two-decimal, integer-safe. Unsupported currencies or nonpositive/excessive amounts fail before any provider call. Expand only with tested gateway currency rules and reviewed business policy.
- Stripe session `checkout.session.completed` / `checkout.session.async_payment_succeeded` only create a success event when `payment_status=paid`. A verified `checkout.session.expired` / `checkout.session.async_payment_failed` produces a failed event. All unrelated events (including `payment_intent.*`) are acknowledged and ignored so they cannot double-process the same payment. Signed but unpaid completion is ignored.
- Signature is computed from **exact raw bytes** as signed by Stripe. `Stripe-Signature` requires a single timestamp, one or more v1 signatures, ±300 seconds freshness, and timing-safe SHA-256 HMAC checking. No shared secret or full external response is sent to browsers.
- The PaymentsService then checks authoritative payment amount/currency and order eligibility, locks via the existing database transaction, changes the Payment and Order state, consumes reservations and writes the escrow HOLD ledger. The client redirect never marks success.
- Refund uses Stripe's PaymentIntent ID retrieved from a previously paid Checkout Session, with an idempotency key derived from the local payment ID plus refund idempotency key. Only a `succeeded` response is accepted as success. **This is NOT yet crash-safe refund orchestration**: the original escrow workflow still calls external refund inside a DB transaction. Financial reconciliation must move it to durable refund intents/outbox/reconciliation before production.

## Safe configuration

Leave `.env` unchanged to keep the sandbox. For Stripe TEST mode (only after confirming an account is available), set values privately in `apps/api/.env` or your secret manager:

```dotenv
NODE_ENV=test
PAYMENT_PROVIDER=stripe
PAYMENT_STRIPE_SECRET_KEY=sk_test_YOUR_OWN_TEST_KEY
PAYMENT_STRIPE_WEBHOOK_SECRET=whsec_YOUR_OWN_STRIPE_CLI_OR_DASHBOARD_SECRET
PAYMENT_STRIPE_RETURN_ORIGIN=https://your-real-web-origin.example
```

The return origin is a **plain HTTPS origin** (no path, credentials or query). NestJS composes order-specific `.../orders/{orderId}?payment=returned|cancelled` URLs itself. Do not commit secrets; do not use `sk_live_` in nonproduction. Confirm the allowed origin and intended gateway currencies for the deployment. Configure your Stripe webhook destination to `https://your-api-domain/api/v1/payments/webhooks/stripe` with `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`. The Stripe CLI can forward to local API test instances, but always use its matching `whsec_` secret. Do not post handcrafted fake events to production.

## Verification commands

### Source-level / locally executable

```bash
pnpm verify:payments
pnpm verify:architecture
pnpm verify:api-contracts
```

### Full, fail-closed acceptance (locked environment and account required)

```bash
# Dedicated localhost test database; DATABASE_URL must equal TEST_DATABASE_URL
# Node.js 24, pnpm 10.15.1, Postgres 18, real pnpm-lock.yaml required
# Set Stripe sk_test_ / whsec_ and HTTPS return origin as above
pnpm acceptance:payments
```

The acceptance runner executes the actual workspace build, typecheck, Jest tests, payment DB tests and a Stripe test-mode API smoke test checking Session creation and repeated idempotent creation. It intentionally fails if the locked runtime, database guard, pinned dependency install, or TEST provider credentials are missing. `verify:payments:stripe` is also available as the isolated provider smoke test.

## Manual live test-mode checkout acceptance

1. Create an authorized Buyer and single-seller order using staging data and a supported two-decimal currency.
2. Begin payment from the order-detail page and confirm HTTPS redirect to the real provider Checkout page. Use only provider-documented test cards.
3. Verify Stripe sends a signed event to the registered webhook URL. Check that the order becomes `PAID`, payment `SUCCEEDED`, escrow `HELD`, one HOLD ledger entry exists, and inventory reservations are consumed exactly once.
4. Replay the same signed webhook. Verify no second state transition or ledger entry. Modify a byte or timestamp to confirm a `401` failure without state changes. Try mismatched amount/currency and ensure no state changes.
5. Test Checkout cancellation, session expiry, provider/API timeout and retry using the same client idempotency key. Ensure no unverified browser success is accepted. Validate card payment failures and retry eligibility.
6. Check that an unsupported currency fails safely, and that no secret key appears in browser code, API payloads, logs or error messages.

## Outstanding release blockers (do not mark production-ready)

- Prerequisite foundation, database, API, storage, and checkout live PostgreSQL/Jest/E2E acceptance remains unresolved until performed on the locked runtime.
- No `pnpm-lock.yaml` has been generated in this environment; obtain the genuine one using `pnpm install --lockfile-only` on Node 24 with access to the package registry, review it and commit it.
- **Financial reconciliation**: durable refund intents, financial outbox/reconciliation of uncertain provider outcomes and delayed/duplicate events, expiring/abandoned external sessions, and safe recovery following crashes/network partitions.
- No Stripe account/test mode credentials or true webhook delivery available in this workspace, so the provider test-mode smoke test and end-to-end payment proof remain pending.
- Actual seller settlement/escrow custody and gateway support in the operating jurisdiction must be separately approved before live launch. This adapter does not implement Stripe Connect, third-party payouts or custodial escrow.
