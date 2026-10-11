# Admin — Administrator management and moderation

**Source blueprint:** §§1, 4, 5.8, 7, 8.2, 11, 16. **Baseline:** Fulfillment cumulative ZIP. **Status:** Code delivered; runtime signoff pending.

## Implemented

- Six new ADMIN-only commands: `POST /api/v1/admin/users/:id/{suspend,reactivate}`, `POST /api/v1/admin/sellers/:id/{suspend,reactivate}`, `POST /api/v1/admin/products/:id/{suspend,reactivate}`.
- Shared Zod 4 moderation reason contract (trimmed, 10–500 characters, rejects unknown fields). IDs are UUID-validated; every route uses JWT, ADMIN RBAC, documented bearer auth and principal-sensitive rate limiting.
- Each domain module owns its data changes through `UsersModuleApi`, `SellerModuleApi`, or `CatalogModuleApi`. AdminModule only delegates; it never mutates another module's Prisma records.
- Serialized, compare-and-swap status transitions with in-transaction audit-log writes. Invalid/no-op transitions return 409. If audit insertion fails, mutation rolls back.
- Users: ACTIVE→SUSPENDED→ACTIVE only; BANNED cannot be reactivated by this endpoint. Administrators cannot suspend themselves or other admins. Suspension revokes their sessions; reactivation requires a fresh login.
- Sellers: ACTIVE↔SUSPENDED. Seller reactivation requires an active owning user account. Suspended sellers (and sellers with suspended user accounts) are excluded from public product lookup, recommendations, comparables, and product image access. New inventory reservation/checkout requires an active user and seller profile. Selling edits and publishing also require an active seller.
- Products: ACTIVE↔SUSPENDED. Reactivation requires an active seller account. DRAFT and ARCHIVED remain outside this moderation pair; historical orders are not deleted.
- Buyer/Seller/Admin frontends: user, seller, and product management actions, human-readable reason prompt, confirmation and error handling.
- Original 74 endpoints and the original technology stack remain unchanged. The six new admin routes are explicitly approved additional endpoints. No new schema fields/migrations required because the statuses and audit log already exist.

## Source checks (can run without registry access)

```bash
node scripts/verify-architecture.mjs
node scripts/verify-api-contracts.mjs
node scripts/verify-admin.mjs
node --experimental-strip-types --test scripts/tests/admin-guards.test.mjs
```

## Live acceptance — MUST run before signoff

Use Node 24, pnpm 10.15.1 and a **genuine** frozen lockfile, PostgreSQL 18 and Docker. Set `NODE_ENV=test`; use an isolated localhost `tradenest_*_test` database with `schema=public` in **both** `DATABASE_URL` and `TEST_DATABASE_URL`. The live moderation scenario inserts disposable fixtures and test-only role setup and **must never** be run against a shared/production database.

```bash
pnpm acceptance:admin
```

If running only the new scenario after prerequisite verification suites have succeeded:

```bash
pnpm --filter @tradenest/api verify:admin:admin
```

The scenario verifies JWT, RBAC, input validation, no-op state conflicts, admin self-protection, logout-on-suspension, seller suspension hiding product discovery, active-seller product reactivation policy, and six persisted audit actions. It is an executable but **not yet executed** test in the current restricted environment.

## Still outstanding / deliberate non-scope

- The root workspace still lacks the genuine `pnpm-lock.yaml` required for reproducible runtime acceptance; do not fabricate one.
- This environment does not provide a Node 24 + pnpm + PostgreSQL 18 test runtime; TypeScript *syntax* and source guards are not full compilation or integration evidence.
- Seller KYC/review workflows, immutable moderation case management, appeal processes, notifications and all production hardening remain subject to product-policy decisions and additional operating capabilities.
- Active financial obligations for suspended parties still follow the existing protected payment/escrow/dispute workflows; suspension is not a financial cancellation or automatic refund.
