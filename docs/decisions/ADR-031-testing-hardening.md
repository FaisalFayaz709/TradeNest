# ADR-031 — Testing hardening and guarded browser workflow surface

## Status
Accepted for this decision.

## Context

The blueprint locks Jest, Playwright, and pytest and requires Playwright end-to-end Buyer/Seller/Admin workflows through the Next.js UI. The current implementation has extensive backend runtime verifiers and AI pytest coverage, but the production Next.js application is still a minimal shell. Treating HTTP/API calls alone as Playwright UI tests would not satisfy the blueprint wording.

## Decision

1. Add Jest as the NestJS unit/integration framework and keep existing runtime verifiers as complementary executable acceptance checks.
2. Add a PostgreSQL Jest integration suite that exercises final integrity, inventory concurrency, and rollback behavior against an isolated test database.
3. Add Playwright to the Next.js app.
4. Add a **test-only** Next.js route at `/__e2e`, guarded by the server-only `TRADENEST_E2E_UI=1` flag.
5. Add a guarded same-origin Next route handler with a fixed Buyer/Seller/Admin probe allowlist. It is not a general API proxy and is unavailable when the E2E flag is off.
6. Seed deterministic role fixtures only into a database whose name contains `test` or `e2e`.
7. Keep pytest as the FastAPI/ML test framework.

## Consequences

- The locked test frameworks are now present in the monorepo.
- Playwright tests exercise a real browser and Next.js UI boundary without claiming the minimal production marketplace UI is feature-complete.
- E2E support is production-disabled by default and cannot be used as a generic upstream proxy.
- Database integration/E2E commands require isolated test databases and fail fast otherwise.
- No domain state machine, schema, migration, payment provider, or AI authority changes are introduced.
