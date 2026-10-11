# TradeNest

TradeNest is a marketplace implementation governed by the frozen `source/TradeNest_Technical_Blueprint.pdf` and the machine-readable constraints in `SPEC_LOCK.yaml`. The application uses a Next.js frontend, a NestJS modular-monolith API, PostgreSQL/Prisma for transactional state, and an internal FastAPI service for advisory AI workloads.

## Architecture

- **Frontend:** Next.js 16 + React. The browser owns user experience, not authoritative marketplace or financial state.
- **Core backend:** NestJS on Node.js 24. Business rules, financial rules, authorization, marketplace APIs, and command-style state transitions live here.
- **Database:** PostgreSQL 18 through Prisma ORM 7. Database constraints are the final integrity boundary.
- **AI service:** Internal FastAPI service for recommendations, pricing suggestions, and fraud-risk support. It is advisory and is not a browser-facing marketplace authority.
- **Contracts:** Shared Zod 4 schemas define application-boundary request and response contracts.

The system keeps Order, Payment, and Escrow as separate state machines; recalculates authoritative pricing and totals on the backend; accepts payment success only after provider verification; and requires transactional, idempotent, audited financial transitions.

## Repository layout

- `apps/web` — Buyer, Seller, and Admin web surfaces plus the same-origin web/API boundary.
- `apps/api` — NestJS modular monolith, Prisma schema/migrations, tests, and domain modules.
- `services/ai` — internal FastAPI AI service and pytest coverage.
- `packages/contracts` — shared Zod contracts.
- `packages/config` and `packages/ui` — shared configuration and UI support.
- `docs` — durable architecture, domain, security, testing, and deployment documentation.
- `source` — frozen authoritative blueprint and its checksum.
- `scripts` — evergreen verification, testing, and deployment helpers.

## Verification

```bash
pnpm verify:architecture
pnpm typecheck
pnpm lint
pnpm test:hardening
```

`pnpm verify:architecture` checks the locked stack and the eleven non-negotiable architecture principles directly from current source. It has no dependency on historical reports, manifests, progress markers, or cumulative implementation records.

## Foundation — reproducible locked foundation

See [`docs/foundation-validation.md`](docs/foundation-validation.md) for the exact Node 24/pnpm 10.15.1 setup, genuine `pnpm-lock.yaml` generation, Docker PostgreSQL 18 startup and the fail-closed acceptance steps. Use `pnpm verify:foundation:environment` for the preflight and `pnpm acceptance:foundation` for the ordered checks. **Foundation is not complete unless these commands succeed in a locked environment and a reviewed lockfile is committed.**

## Database — PostgreSQL schema and integrity verification

See [`docs/database-integrity.md`](docs/database-integrity.md). `pnpm verify:database` verifies the unmodified historical migration checksums and 27 Prisma table mappings. On the **locked Node 24/pnpm 10.15.1/PostgreSQL 18** environment with an actual reviewed lockfile, `pnpm acceptance:database` applies migrations to an **isolated localhost `tradenest_*_test` database** and tests indexes, constraints, transaction rollback and guarded concurrent stock reservations. Database integration is **not signed off** unless the live command completes successfully; the delivered ZIP was assembled without Docker/PostgreSQL and lacks the real dependency lockfile pending Foundation acceptance.

## Api contracts — API routes, JWT/RBAC, Zod boundaries and OpenAPI

See [`docs/api-auth-contracts.md`](docs/api-auth-contracts.md). `pnpm verify:api-contracts` checks all **74 distinct required blueprint routes** (plus six explicitly allowlisted existing extensions), bearer/RBAC declarations, Zod inputs and Swagger bearer metadata; `pnpm test:api-contracts:guards` runs dependency-free negative-regression tests. Once the authentic Node 24/pnpm lockfile and localhost PostgreSQL 18 test database are available, `pnpm acceptance:api-contracts` executes the prerequisite verification suites and real NestJS/OpenAPI HTTP/JWT/ownership integration tests. **A passing source scan is not equivalent to a complete working marketplace; live API contract sign-off is still pending.**

## Deployment readiness

```bash
pnpm deploy:preflight
pnpm deploy:config
pnpm deploy:build
pnpm deploy:up
pnpm deploy:smoke
```

See `docs/deployment-release-gate.md` for release requirements and unresolved provider selections. The repository does not claim production readiness until those requirements are satisfied in the target environment.

## Source of truth

The frozen technical blueprint has highest precedence. `SPEC_LOCK.yaml`, ADRs, domain docs, tests, and verification scripts are derived guardrails. If a derived artifact conflicts with the blueprint, update the derived artifact rather than silently changing the blueprint.

## Storage — managed product images and dispute evidence

Product images and dispute evidence now use a private S3-compatible bucket, short-lived signed browser uploads, backend key/size/type/content checks, and owner-scoped registration. Public active-product images are streamed through the existing Next.js -> NestJS API boundary; evidence is accessible only through short-lived download URLs issued after participant/Admin policy checks. See `docs/storage-and-uploads.md` for setup, bucket CORS, local testing, and limitations. Run `pnpm verify:storage` to inspect the code and `pnpm acceptance:storage` in the locked environment for full acceptance.
