# Payment compliance — Independent audit remediation (2026-10-08)

## Scope and immutable boundaries

Basis: Frontend independently audited archive, the original 21-page `TradeNest` Technical Blueprint, and `SPEC_LOCK.yaml`. Do not replace Next.js 16, Node.js 24, NestJS modular monolith, PostgreSQL 18, Prisma ORM 7, Zod 4, Python/FastAPI, Tailwind/shadcn, JWT/bcrypt/RBAC, or the original API contracts. All historical migrations remain unchanged.

## Corrected defects

1. **Stripe deployment:** `scripts/validate-deployment-env.mjs` accepts `sandbox` or Stripe **test mode only** with strict `sk_test_`, `whsec_`, and bare HTTPS origin checks. The test-mode credentials are forwarded through the existing API/migration Compose environment; no new service or public API was introduced. Live Stripe operations continue to fail closed.
2. **Payment initiation:** an `idempotencyRecord` claim and a unique, stable payment UUID/provider-initialization marker are committed while the order row is locked. The external payment-provider request then runs **outside** any SQL transaction. After the provider responds, a second serializable transaction binds the provider session and completes the original idempotency claim. A matching pending claim is recoverable with the **same Idempotency-Key**. A competing key is rejected. An uncertain Stripe attempt older than 20 hours requires manual reconciliation instead of a new provider write. The reservation sweeper must not release an initializing external payment.
3. **Documentation drift:** updated release/deployment docs to reflect the implemented Stripe test provider, Financial reconciliation durable refunds, and S3-compatible upload adapter without claiming they have passed live acceptance.
4. **Acceptance gates:** Payment compliance source regression and deployment validator tests, a fail-closed cumulative acceptance command, and a CI workflow requiring an authentic frozen lockfile and actual Node.js 24/pnpm 10.15.1 builds.

## Known limitations / blocking acceptance

- **Not certified:** no genuine `pnpm-lock.yaml` can be generated without package registry access. Use `.github/workflows/lockfile-bootstrap.yml` on an environment with registry access, review/download the actual lockfile, commit it, and verify `pnpm install --frozen-lockfile`. Do not fabricate the file.
- Node.js 24/pnpm 10.15.1, Docker/PostgreSQL 18, native NestJS Jest and Playwright, actual signed Stripe test webhooks, S3 upload flows, and failure-injection scenarios **must** pass before the core acceptance suite can be approved.
- Crash recovery that remains unresolved after the provider's idempotency retention window intentionally blocks; reconciliation must match confirmed Stripe provider metadata to the local payment UUID, or explicitly expire an unpaid session before releasing inventory.
- A signed Stripe webhook arriving before the local provider-session binding is committed will be rejected for provider retry, not treated as paid. Test this delivery ordering with the actual gateway.
- Real fund custody/settlement and legally regulated escrow are outside a logical database escrow ledger and require separate provider/legal approval.

## Acceptance

Run from a genuine **Node 24 + pnpm 10.15.1** environment with a reviewed lockfile and PostgreSQL 18, S3 test bucket, and Stripe **test** keys:

```bash
pnpm verify:payment-compliance
pnpm acceptance:payment-compliance
```

The full runner includes prerequisite acceptance, TypeScript builds/tests, payment DB checks, Stripe and S3 integration, and deployment preflight. A failure or skipped live prerequisite is **NOT ACCEPTED**. Do not enable live Stripe until financial/legal/operational release checks are separately approved.
