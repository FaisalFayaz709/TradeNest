# Testing Strategy

Source of truth: TradeNest Technical Blueprint §14.

The locked test stack is now represented directly in the repository:

- **Jest** — NestJS unit and integration tests for services, authorization/policies, state transitions, payment behavior, escrow behavior, and repositories/database integrity.
- **Playwright** — browser-driven Buyer, Seller, and Admin workflows through a Next.js UI surface.
- **pytest** — FastAPI and ML pipeline tests.
- **PostgreSQL integration coverage** — uniqueness, foreign keys, inventory concurrency, transactions, and rollback behavior.

## Jest scope

The repository includes unit regression suites for:

- RBAC + ownership + domain policy separation;
- Order state-machine command transitions;
- Escrow transition legality/idempotency;
- payment webhook verification, duplicate success idempotency, amount mismatch, failed-payment isolation, and downstream fraud assessment ordering.

The database integration suite runs only against an isolated `TEST_DATABASE_URL` whose database name contains `test` or `e2e`. It refuses to run against an ordinary database name.

## Playwright scope

Playwright covers real Buyer, Seller, and Admin commerce workflows through the runtime Next.js application. A deliberately test-only role probe at `/__e2e` remains available for narrow authorization checks.

The route is unavailable unless:

```text
TRADENEST_E2E_UI=1
```

The corresponding Next route handler is also disabled by default and contains a fixed role-to-endpoint allowlist:

- Buyer → `/users/me`
- Seller → `/seller/analytics`
- Admin → `/admin/fraud-alerts?limit=1`

The browser never selects an arbitrary upstream path. The test proxy strips login tokens from its response and exists only so Playwright can drive an actual Next.js page without requiring cross-origin browser configuration solely for a test harness.

The Playwright E2E runner uses a separate `E2E_DATABASE_URL`, applies migrations, seeds deterministic role fixtures, starts NestJS + Next.js, and drives the role UI in Chromium.

## Database test isolation

Use dedicated databases such as:

```text
tradenest_test
tradenest_e2e
```

Never point `TEST_DATABASE_URL` or `E2E_DATABASE_URL` at production, staging, or developer data that must be preserved. Both the integration-test guard and E2E fixture seeder reject database names that do not contain `test` or `e2e`.

## Full hardening test command

Under the locked Node.js 24 + PostgreSQL 18 environment:

```bash
pnpm test:hardening
```

This runs Jest unit tests, PostgreSQL Jest integration tests, Playwright UI E2E tests, and pytest AI tests. The isolated test databases must already exist; the root integration/E2E orchestrators apply migrations to their respective databases before running the suites.

## Testing boundaries

The test strategy verifies product behavior and architecture controls but does not choose an observability vendor or production cloud topology. Rate limiting, observability, and deployment controls are documented and verified separately.
