# Database — PostgreSQL 18 / Prisma 7 database-integrity acceptance

**Delivery status: VERIFICATION TOOLS IMPLEMENTED; LIVE DATABASE ACCEPTANCE PENDING.**

## Scope and invariants

This pass continues from the supplied Foundation ZIP. The original `source/TradeNest_Technical_Blueprint.pdf` (especially sections 6, 8, 10, 11, 14 and 16) and `SPEC_LOCK.yaml` remain authoritative. The stack stays **PostgreSQL 18 + Prisma ORM 7**, managed by one NestJS modular monolith with a separate internal Python/FastAPI AI service. No production services, controller/endpoint contracts, state machines or UI libraries have been changed.

All four existing migration files are **unchanged** and SHA-256 guarded by `scripts/migration-baseline-sha256.json`. The Prisma schema is unchanged. Creating speculative new migration constraints is intentionally deferred because the existing SQL already implements the blueprint's specified UNIQUE, FK and CHECK guarantees. Add any genuinely required future constraint in a new reviewed migration, never by rewriting applied migrations.

## Changes delivered

- `scripts/verify-database-migration-chain.mjs`: dependency-free static verification of the **four locked baseline migration checksums**, all **27 Prisma-model/table mappings**, required named checks/indexes and financial precision declarations. Runs even without npm dependencies.
- `apps/api/scripts/verify-database-foundation.ts`: previous table/index checklist now additionally verifies the existing `idempotency_records` table and its two named indexes.
- `scripts/verify-database-target.mjs`: fail-closed allowlist requiring a loopback PostgreSQL database named `tradenest_*_test`, using the `public` schema.
- `scripts/prepare-test-database.mjs`: creates that test database only if it does not exist; never drops or resets a database.
- `apps/api/scripts/verify-database-integrity.ts`: actual PostgreSQL 18 catalog inspection and transaction-backed probes for table/constraint/index/FK presence, specified NUMERIC precisions, immutable-in-history snapshot *columns*, unique records, negative quantities/prices, ratings, payment amounts, idempotency, SQL transaction rollback, and two concurrent guarded attempts at the final inventory item. Tests create unique fixtures and clean them up by ID. **The snapshot content's lifecycle immutability remains an application-level requirement**; this pass verifies storage, not all service mutation paths.
- `scripts/accept-database.mjs`: ordered fail-closed, complete test-database acceptance; uses genuine pnpm dependencies, runs Prisma migrations against the isolated database, and verifies the architecture both before and after.
- `.github/workflows/database-integrity.yml`: CI running Node 24, pnpm 10.15.1, Python 3.13 and Compose PostgreSQL 18. It will fail (correctly) until the genuine `pnpm-lock.yaml` from Foundation is generated and committed.
- `scripts/tests/database-guards.test.mjs`: dependency-free test coverage for static and safe-target guards.

## How to run — after Foundation is accepted

Use the same verified Node 24 / pnpm 10.15.1 / Docker environment used in Foundation. Do **not** run against a shared, staging or production database. Ensure the `pnpm-lock.yaml` has been generated with the real registry and reviewed.

```bash
# From the monorepo root
nvm use 24
corepack enable
corepack prepare pnpm@10.15.1 --activate

# Required for the DB foundation verifier (can also be loaded from apps/api/.env)
export JWT_ACCESS_SECRET='local-testing-only-secret-at-least-32-characters'
export PAYMENT_SANDBOX_WEBHOOK_SECRET='local-webhook-testing-secret-at-least-32-characters'
export CATALOG_DEFAULT_CURRENCY=USD

# The live Database runner refuses any remote DB or DB not ending in *_test.
export TEST_DATABASE_URL='postgresql://tradenest:tradenest_local_only@127.0.0.1:5432/tradenest_test?schema=public'
export DATABASE_URL="$TEST_DATABASE_URL"

node --test scripts/tests/database-guards.test.mjs
pnpm verify:database
pnpm acceptance:database
```

`acceptance:database` runs the following in order:

1. Verify historical SQL migration hashes, required tables/indexes and model mappings.
2. Reject remote, production, non-test and non-public-schema DB targets.
3. Re-verify the locked Foundation toolchain and real reviewed lockfile; execute frozen dependency installation.
4. Re-run source architecture checks and start the existing PostgreSQL 18 Docker Compose service.
5. Ensure PostgreSQL readiness; create (never delete) the dedicated test DB if needed.
6. Validate/generate Prisma ORM 7; build the shared config package.
7. Apply all existing migrations to **only** the isolated test DB and verify migration status.
8. Run existing foundation verifier and the new live SQL probes, rollback tests and concurrent final-item reservation test.
9. Run the architecture verifier again.

All commands stop at the first failure. Their success cannot be inferred from checking in the scripts.

## Explicit scope limitation

The concurrent inventory test proves PostgreSQL's **atomic guarded SQL update** behavior, not that all application checkout paths use it correctly. Service-level inventory reservation under concurrent checkouts is Checkout. This pass also does not certify refunds/escrow synchronization, notification delivery, any provider integration, or the complete end-to-end marketplace.

Foundation sign-off remains blocked until Node 24/pnpm 10.15.1, a genuine lockfile, Docker/PostgreSQL 18 and full builds are verified. Database may not be signed off until its independent live acceptance command passes as well.

## Results observed when preparing this ZIP

| Check | Result |
|---|---|
| Static migration checksums and all Prisma table mappings | PASSED |
| 5 local guard unit tests | PASSED |
| Existing 11-point architecture checker | PASSED |
| Real PostgreSQL 18 SQL constraints and concurrent-write tests | **NOT RUN** (no Docker/PG tools in environment) |
| Prisma migrate deploy/status against isolated PG18 test database | **NOT RUN** (no Node 24, pnpm lockfile, PostgreSQL service) |
| Full Database acceptance | **NOT ACCEPTED** pending runtime verification |

This is a deliberate **fail-closed partial implementation** rather than an unsupported declaration of 100% completion.
