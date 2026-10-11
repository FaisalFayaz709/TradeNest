# TradeNest — Financial reconciliation: Durable Refunds, Escrow Finalization and Payment Reconciliation

**Status: SOURCE IMPLEMENTED; LIVE RUNTIME ACCEPTANCE AND PRODUCTION RELEASE NOT APPROVED.**

Reference: `source/TradeNest_Technical_Blueprint.pdf` §§ 2–3, 5–8, 11–12, 16–17. `SPEC_LOCK.yaml` is preserved. Financial reconciliation extends the **existing NestJS modular monolith**; it does not introduce payment microservices, a new ORM, a payment-authoritative frontend, or any new public route. Foundational payment and remediation safeguards remain mandatory.

## What this pass changes

1. **Append-only migration:** `202610080007_durable_refund_operations` adds one durable refund obligation per escrow; PostgreSQL checks and unique indexes prevent duplicate provider references and invalid amounts. Its Prisma model declares the matching relationships and indexes. No historical migration was edited.
2. **Enqueue then dispatch:** Both the administrator's `POST /escrows/:id/refund` and `REFUND_BUYER` dispute resolution enqueue the *same kind* of obligation inside a short database transaction. They do **not** perform remote provider requests inside that transaction. API financial mutation returns an explicitly *pending* response. Order/escrow/dispute do not prematurely say `REFUNDED` or `RESOLVED`.
3. **In-monolith reconciliation:** A NestJS worker claims obligations with PostgreSQL `FOR UPDATE SKIP LOCKED`, an attempt counter and lease. Each obligation has a stable provider idempotency identity `tradenest-refund-<operation-uuid>`. The only gateway call runs **outside** the database transaction.
4. **Safe retries:** On a timeout, expired lease, pending provider refund or unknown result, the worker performs **read-only refund lookup**, never an automatic second provider refund POST. If a refund cannot be positively identified it stays `NEEDS_REVIEW`. The worker may periodically *read-only* reconcile it; manual escalation is required when provider state remains unclear.
5. **Atomic verification:** On a verified completed refund, one serializable database transaction writes the escrow REFUND ledger entry, Order `REFUNDED`, applicable Dispute `RESOLVED`, durable operation `SUCCEEDED`, and audit event. A queue record blocks any competing escrow `RELEASE` even before the provider finalizes the refund.
6. **Stripe adapter:** Test-mode Stripe refund creation and read-first reconciliation are implemented, with strict Checkout Session/PaymentIntent identity, amount and currency verification. New live-money charges **and all live refunds remain disabled** pending provider-specific and business/legal production acceptance. Sandbox provider remains supported.
7. **Pending-checkout stock recovery:** For externally pending Stripe Checkout sessions, a reservation may expire only when Stripe first **confirms an unpaid terminal session**; the internal payment is then marked failed under its order lock, before stock can be released. A paid, ambiguous or unreachable session retains reservation for reconciliation rather than double-selling inventory.
8. **Scope:** All 74 blueprint API route declarations and existing additional route declarations are preserved. `GET /orders/:orderId/escrow` may be polled by authorized parties for eventual escrow state. The pending-operation queue itself is not a public endpoint.

## Financial invariants and failure handling

| Scenario | Expected safe result |
|---|---|
| Duplicate admin refund (same request key) | Replays original queued response; no second obligation |
| Duplicate admin refund (different request key) | Escrow UNIQUE constraint prevents a second obligation |
| Release while refund queued/pending/uncertain | Release update fails because refund obligation exists |
| DB transaction fails before queue commits | No provider call is made |
| Provider accepts refund; worker crashes before DB update | Stable ID + read-only provider refund lookup on retry; no blind second POST |
| Refund still `pending` at Stripe | Operation is rescheduled for read-only reconciliation |
| Provider result cannot be verified | `NEEDS_REVIEW` / no ledger finalization; read-only recheck and manual escalation |
| External payment still may succeed | Do not restore reservation until provider-confirmed expiry |
| Duplicate release/refund race | Database conditional updates, row locks, and unique refund record protect exclusivity |

**Caution:** `NEEDS_REVIEW` is not a completed refund. An operator must investigate if read-only reconciliation cannot establish the provider outcome. Do not manually change `escrows`, `refund_operations`, `payments` or the ledger directly. Escalation must use a reviewed reconciliation operation with an audit trail, built and tested before full operations release.

## New/modified implementation paths

- `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/202610080007_durable_refund_operations/migration.sql`
- `apps/api/src/modules/escrow/{refund-operation.repository,refund-policy,refund-reconciliation.service}.ts`
- Existing `EscrowService`, `EscrowCommandsService`, `EscrowRepository`, controller/module
- Existing `DisputesService`, dispute module API and controller
- Existing `PaymentsService`, Payments module API, provider interface, Stripe and sandbox providers
- Existing `OrderExpirationService`
- `apps/api/test/unit/refund-reconciliation.spec.ts`
- `apps/api/scripts/verify-financial reconciliation-{refund-database,stripe-refund}-runtime.ts`
- `scripts/verify-financial-reconciliation.mjs`, `scripts/tests/financial-reconciliation-invariants.test.mjs`, `scripts/accept-financial-reconciliation.mjs`
- `.github/workflows/financial-reconciliation.yml`

## Commands

Run fast static/source tests (do not claim runtime success):

```bash
node scripts/verify-architecture.mjs
node scripts/verify-api-contracts.mjs
pnpm verify:financial-reconciliation
```

Run **full cumulative acceptance** on the approved environment with **Node.js 24**, **pnpm 10.15.1**, **PostgreSQL 18**, a genuine reviewed `pnpm-lock.yaml`, isolated S3/test databases and Stripe test keys:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm acceptance:financial-reconciliation
```

`pnpm acceptance:financial-reconciliation` executes the earlier pass gates and then requires the new Prisma validation, generated client, type checks, Jest, live PostgreSQL constraints and **opt-in** Stripe test refund smoke test. It is intentionally fail-closed without real dependencies/test credentials.

For the **Stripe test-mode refund smoke test** additionally set:

```bash
STRIPE_TEST_REFUND_ACK=yes
PAYMENT_STRIPE_SECRET_KEY=sk_test_<use-real-test-secret>
STRIPE_TEST_REFUND_PAYMENT_ID=<id-of-a-dedicated-PENDING-TO-SUCCEEDED-TEST-payment>
STRIPE_TEST_REFUND_CHECKOUT_SESSION_ID=cs_test_<paid-test-checkout-session>
STRIPE_TEST_REFUND_AMOUNT=<exact-checkout-total-major-units>
STRIPE_TEST_REFUND_CURRENCY=USD
```

The smoke test creates exactly **one test-mode refund**, then checks that read-only reconciliation identifies that same refund. Never run it with production payment IDs or live keys. Configure secrets outside version control.

## Still open for acceptance

- Genuine `pnpm-lock.yaml`: prerequisite from Foundation remains missing in this archive; generate with the documented GitHub Actions lockfile workflow or the locked local toolchain. Do **not** fabricate one.
- Full Node 24/pnpm 10.15.1 compilation, Jest, Playwright, Prisma migration execution and PostgreSQL 18 integrity checks are **not executed** in the archive assembly environment.
- Actual Stripe test checkout/webhook/refund behavior and live S3 upload tests remain **not executed** here.
- Real-money live Stripe new charges/refunds remain **blocked** until finance operations, compliant fund custody/seller settlement, webhook/reconciliation disaster recovery, jurisdiction/payment-provider approval, and full release verification are complete. Logical `escrows` records are not proof of legally regulated escrow.
- A reviewed, audited **manual operator resolution workflow** for permanent `NEEDS_REVIEW` cases should be added before production operations; automated read-only rechecks must not be treated as a replacement for investigation.
- No statement of 100% stack, architecture, feature completeness or live financial safety is valid until acceptance passes in the locked environment.

## Acceptance decision

**SOURCE IMPLEMENTATION: DELIVERED. RUNTIME ACCEPTANCE: PENDING. PRODUCTION LIVE-MONEY USE: BLOCKED.**
