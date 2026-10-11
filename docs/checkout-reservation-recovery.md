# Checkout — Checkout inventory reservation recovery

## Status and scope

**Implemented in source; runtime sign-off PENDING.** Retains the foundation, database, API, and storage boundaries and leaves the blueprint, `SPEC_LOCK.yaml`, historical migration SQL, 74 mandatory endpoints, REST prefix, and the modular monolith untouched. Real payment provider integration and reconciliation remain separate release requirements.

## What changed

- One additive Prisma field `Order.paymentExpiresAt` and migration `202610080006_checkout_payment_expiration`, indexed by status/deadline/ID. Existing orders remain `NULL` intentionally and are **not silently canceled**, because some may have unresolved provider state.
- Checkout computes a bounded authoritative 30-minute deadline (configurable 5–1440 minutes) within the same serializable transaction that reserves inventory, snapshots totals and creates the payment record. Frontend receives no authority to control the deadline.
- `OrderExpirationService` lives inside OrdersModule, uses the existing DatabaseTransactionService and explicit Catalog/Payments public APIs. Runs bounded batches; keeps a cursor to avoid starving rows behind unresolved external attempts. Each order is `FOR UPDATE` locked, rechecked, conditionally canceled and all its reserved inventory returned in one database transaction. Other workers racing on the same row cannot release twice.
- Existing payment initiation checks expiry after locking the order; expired orders cannot start an external provider payment. Webhook success checks order eligibility under the same order lock *before* the payment/stock/escrow financial updates. Conflicting success requires reconciliation and never automatically recreates released reservations.

## Critical safety distinction

An expired order with `INTERNAL_PENDING` (or terminal `FAILED`) payment can safely expire, because no known active external transaction can capture funds. **An order with an externally pending provider payment is not automatically expired**; the provider may already have accepted funds but not delivered the webhook. The worker logs this for reconciliation and leaves stock reserved. Until Payments/07 implements provider cancellation and reconciliation, these orders may still require operator attention; Checkout therefore does **not** guarantee recovery of all pending-provider reservations.

Late payment success for an already canceled order is rejected with `PAYMENT_RECONCILIATION_REQUIRED` rather than consuming already released stock or recording HELD escrow. External refund handling is explicitly deferred to the payment/reconciliation passes. Do not treat that rejection as a completed refund.

## Configure

Use the environment examples from the ZIP. Values: `CHECKOUT_PAYMENT_TTL_MINUTES=30`, `CHECKOUT_EXPIRY_SWEEP_SECONDS=60`, `CHECKOUT_EXPIRY_SWEEP_ENABLED=true`. For isolated tests set `NODE_ENV=test` (worker disabled) and invoke `sweepOnce` via service test harness.

## Acceptance

Run source gates anywhere with Node: `node scripts/verify-checkout.mjs` and `node --test scripts/tests/checkout-guards.test.mjs`.

On **Node 24, pnpm 10.15.1, PostgreSQL 18, with a real frozen `pnpm-lock.yaml`**, use a prepared localhost dedicated `_test` PostgreSQL database and set `DATABASE_URL=TEST_DATABASE_URL`, then run `pnpm acceptance:checkout`. This runs migrations, checkout/payment regressions, Jest and a real NestJS expiration service against PostgreSQL. Without that output, no live pass claim.

## Deferred hardening

Provider pending reservations require verifiable provider cancel/reconcile semantics before automatic release. Real-money provider implementation and external settlement/reconciliation require provider and financial reconciliation safeguards. Product UX may later improve expired-checkout cart restoration, but must never simply revive expired financial records.
