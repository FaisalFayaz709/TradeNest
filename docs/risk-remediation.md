# Financial remediation — Post-audit remediation (PRE-FINANCIAL RECONCILIATION)

**Status: implemented source remediations; NOT accepted for full runtime compliance or production.**

Requirements authority: `source/TradeNest_Technical_Blueprint.pdf`, sections 2–3, 5, 7–12, 16–17. `SPEC_LOCK.yaml` is the secondary mechanical guardrail. This is the **cumulative Payments audited archive plus incremental remediation**, not a replacement architecture.

## Scope and disposition of audit findings

| Audit item | Remediation in this pass | Acceptance boundary |
|---|---|---|
| F-01 Missing reviewed `pnpm-lock.yaml` | Added manual GitHub Actions workflow `lockfile-bootstrap.yml`, generating a **real** lockfile with Node 24 + pnpm 10.15.1 and uploading it for review. No fake lockfile or unreviewed auto-commit. | **OPEN** until generated/reviewed/committed and `pnpm install --frozen-lockfile` succeeds. Registry is unavailable in archive assembly environment. |
| F-02 No actual locked-runtime/DB evidence | Added `acceptance:financial-remediation` that fails closed and requires locked environment, genuine lockfile, typecheck/build, and cumulative Database–6 live acceptance. | **OPEN**, must run on Node 24/pnpm 10.15.1/PostgreSQL 18/isolated S3/Stripe test credentials. |
| F-03 External refund within DB transaction | Stripe refunds now **fail closed before any provider refund call** in both test and live modes; New Stripe live-key charges are blocked at the provider initiation boundary pending durable reconciliation; signed inbound webhooks remain enabled for recovery of existing provider events. Existing sandbox flows preserved. | **SAFETY MITIGATION, NOT A FIX**: Financial reconciliation must replace the in-transaction provider refund workflow with durable intent/reconciliation and update acceptance gates. Production payments remain disabled. |
| F-04 Stripe live test mode | Kept Stripe `sk_test_` checkout and signed webhook implementation and existing Payments smoke test; added safety-unit cases. | **OPEN** until hosted checkout test-mode session, actual webhook and persistence verified. |
| F-05 Provider-pending reservations | Preserved the order sweeper's `externalPending` safety check (never release stock that could already be paid); added structural guard that would reject its removal. | **OPEN** until Financial reconciliation provider cancellation/reconciliation. Do not force-cancel or release these reservations. |
| F-06 shadcn/ui mismatch | Replaced custom control primitives with shadcn-style New York implementation using CVA, Radix Slot, `forwardRef`, standard Card composition, `clsx` + `tailwind-merge`. Preserved TradeNest colors and legacy variants/tones. | **SOURCE REMEDIATED; runtime/provenance verification pending**. Run the shadcn CLI and review component diffs under locked Node 24, install pinned dependencies and test UI behavior. |
| F-07 S3 live upload not proven | Preserved Storage S3 tests and its acceptance workflow. | **OPEN** until real S3 test bucket, permissions, CORS, and upload/access tests. |
| F-08 API route behavior not proved | Re-run Api contracts executable HTTP matrix; existing 74/74 source route checker unaffected. | **OPEN** until executed positive/negative functional coverage. |
| F-09 future product features | Not part of this remediation. | Downstream product, financial, and operations suites remain required for completion. |

## Files changed intentionally

- `apps/web/components/ui/{button,badge,card,input,textarea}.tsx` — shadcn New York-style compositions and backward-compatible TradeNest variants.
- `apps/web/lib/cn.ts`, `apps/web/lib/utils.ts` — `cn` utility based on `clsx` / `tailwind-merge`.
- `apps/web/package.json` — adds shadcn's standard `@radix-ui/react-slot`; no framework major or backend changes.
- `apps/api/src/modules/payments/provider/{stripe-checkout.provider.ts,stripe-checkout-core.ts}` — disable live key payment initiation and all external Stripe refunds until Financial reconciliation.
- `scripts/verify-payments.mjs` — source assertion changed from active refund idempotency to stronger fail-closed rule; historical controls otherwise retained.
- `package.json` — `verify:financial-remediation` and `acceptance:financial-remediation`.
- New source regressions, CI workflows and this document.

**Not changed:** original blueprint, `SPEC_LOCK.yaml`, Prisma schema, migrations, API route declarations, module graph, UI brand palette or the locked stack.

## Run dependency-free checks (Node 22+ sufficient for static only)

```bash
node scripts/verify-architecture.mjs
node scripts/verify-api-contracts.mjs
node scripts/verify-financial-remediation.mjs
node --experimental-strip-types --test scripts/tests/financial-remediation-financial-safety.test.mjs scripts/tests/financial-remediation-ui-structure.test.mjs
```

## Finish the environment gate using authentic dependency resolution

1. Open GitHub Actions and manually run **TradeNest Financial remediation - Genuine pnpm Lockfile Bootstrap** with registry access, or run `pnpm install --lockfile-only` locally under Node 24/pnpm 10.15.1.
2. Download and **review** `tradenest-genuine-pnpm-lockfile` (workspace importers, versions, registries, licenses/security) then commit `pnpm-lock.yaml` to the repository. The CI action does not commit for you.
3. On the fully configured locked environment, run `pnpm install --frozen-lockfile`, `pnpm acceptance:foundation`, and `pnpm acceptance:financial-remediation` with isolated test resources and **test-mode** Stripe keys.
4. Independently verify real Stripe webhooks, S3 upload evidence and 74 API operations. Save actual test logs as acceptance evidence.

### Non-negotiable financial limitation

The pre-Financial reconciliation version **does not process real Stripe charges or Stripe refunds**. `sk_live_` new payment initiation fails with `STRIPE_LIVE_MODE_NOT_APPROVED` (signed inbound webhooks are still verified); Stripe refunds fail with `STRIPE_REFUND_RECONCILIATION_NOT_READY`. The existing NestJS service still calls the provider from a DB transaction and must be rebuilt for external effects before lifting either gate. These are intentional safety blocks, not proof that the financial workflow has been completed.

No part of this document certifies live financial custody/settlement; a logical ledger record is not legally regulated escrow.

## Financial remediation decision

- Architecture / locked-stack **source** preservation: recheck with `pnpm verify:financial-remediation`.
- Strict shadcn New York source conventions: implemented but final CLI/runtime check is pending.
- Fully completed foundation, database, and payment verification suites: **NO** until real lockfile and cumulative live tests exist.
- Production real-money approval: **NO** pending Financial reconciliation refund/reconciliation, gateway verification and regulatory/payment-provider setup.
