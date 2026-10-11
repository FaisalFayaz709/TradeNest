# TradeNest Fulfillment — Fulfillment, Disputes, Cancellations & Reviews

## Baseline and lock

Built cumulatively from `TradeNest_Pass07_Durable_Refund_Reconciliation.zip` (including Financial remediation). The original 21-page TradeNest Technical Blueprint and `SPEC_LOCK.yaml` remain authoritative. No new public API endpoints, framework substitutions, microservices, role changes, or historical migration rewrites.

## Confirmed fix: one shipment per order

- Previously `shipments.order_id` was not unique even though the locked single-seller MVP uses one shipment per order. The shipping repository used `findFirst`, which could conceal duplicates.
- New **additive** migration `202610080008_single_shipment_fulfillment_guards` rejects existing duplicates/invalid rows with explicit exceptions (no destructive cleanup), adds a unique index on `order_id`, enforces legal SHIPPED/DELIVERED status/date combinations, and requires non-empty carrier and tracking.
- Prisma `Order.shipment Shipment?` and unique `Shipment.orderId` express the same one-to-one model. Required fields match DB constraints.
- Shipping repository now uses `findUnique`; repeat shipment requests only replay an **identical** carrier/tracking code. Conflicting retries return `409 SHIPMENT_ALREADY_EXISTS` without modifying financial or fulfillment state.
- The existing shipping verifier was extended with a negative conflicting-replay scenario.

## Existing behavior retained and acceptance-gated

- Orders: backend-controlled cancellation allowed only before successful payment and only if no outstanding external payment; reserved inventory returns transactionally. Captured money follows the durable refund workflow, not a direct cancellation.
- Shipping: only the owning seller of a PAID/PROCESSING order with HELD escrow creates a shipment. Shipment, order and escrow transitions share one serializable transaction.
- Buyer delivery: buyer ownership, SHIPPED order, SELLER_SHIPPED escrow and no active dispute required; shipment delivery and escrow release happen together, with financial idempotency and audit records.
- Disputes: buyer-owned eligible order opens dispute; only authorized participants see/submit messages or managed storage evidence. Admin outcomes follow the Financial reconciliation refund outbox or guarded seller release. Refund remains pending until verified provider outcome.
- Reviews: the authenticated buyer must own a COMPLETED purchased order item; the DB guarantees one review per item and rating 1–5.

These are regression gates for **existing** code, not claims of live test coverage in this environment. Review the actual implementation and execute all runtime acceptance scripts.

## Quick static validation (no dependencies)

```bash
node scripts/verify-architecture.mjs
node scripts/verify-api-contracts.mjs
node scripts/verify-database-migration-chain.mjs
node scripts/verify-financial-reconciliation.mjs
pnpm verify:fulfillment
```

## Full acceptance (requires locked runtime and configured external services)

**Requirements:** Node.js 24, pnpm 10.15.1, genuine committed `pnpm-lock.yaml`, isolated **localhost PostgreSQL 18 database whose name contains `test`**, all prerequisite acceptance suites succeeded, configured test-only payment and storage accounts, and Playwright browser dependencies. Do not use a development/production database.

```bash
export DATABASE_URL='postgresql://tradenest:***@127.0.0.1:5432/tradenest_test'
pnpm acceptance:fulfillment
```

The acceptance runner rechecks architecture, all 74 route declarations, historical migrations, Financial reconciliation financial invariants, this pass's policy tests, and prior runtime acceptances. Only after these gates does it validate Prisma, verify the DB target, apply additive migrations to the isolated test database, regenerate Prisma Client, typecheck, run Jest, exercise Shipping/Delivery/Cancellation/Disputes/Reviews against the actual NestJS and PostgreSQL layers, then execute Playwright E2E.

If legacy shipment data has duplicates or invalid states, the new migration **will fail deliberately**. Reconcile affected records manually with a reviewed data migration and audit evidence; never quietly drop or overwrite shipment history.

## Evidence in this archive

- `scripts/verify-fulfillment.mjs`
- `scripts/tests/fulfillment-invariants.test.mjs`
- `apps/api/scripts/verify-fulfillment-database-runtime.ts`
- `.github/workflows/fulfillment.yml`
- `scripts/accept-fulfillment.mjs`

## Unverified/blocked

The current work environment has Node.js 22, no pnpm, no Docker/PostgreSQL 18 and no genuine lockfile. Static checks plus dependency-free tests and Python AI tests can run; **Prisma 7 validation and generation, TypeScript compilation, actual migrations, live API/Jest/Playwright tests and Stripe/S3 tests have not passed here**. Therefore Fulfillment is **implemented but NOT runtime accepted**. The broader project is **not production approved**.
