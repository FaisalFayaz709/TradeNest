# Api contracts — APIs, authentication, authorization, validation and Swagger

**Implementation delivered; full acceptance is NOT VERIFIED until the `pnpm acceptance:api-contracts` command passes in Node.js 24 / pnpm 10.15.1 with real PostgreSQL 18.** This ZIP contains no fabricated lockfile and no claim of successful live API tests.

## Scope and non-negotiable constraints

Continue from Database. `source/TradeNest_Technical_Blueprint.pdf` (especially §5 and §7–§16) and `SPEC_LOCK.yaml` remain authoritative. All existing NestJS modules, repository boundaries, Zod 4, Next.js 16, PostgreSQL 18, Prisma ORM 7, JWT/bcrypt, Python/FastAPI AI, REST `/api/v1`, payment and escrow state machines and pre-existing API paths remain unchanged. Do not replace the modular monolith with microservices.

## Delivered

1. **74-operation blueprint manifest**: `scripts/blueprint-endpoints.json`, containing 74 *distinct* blueprint route signatures (the admin dispute resolve endpoint is listed twice across §5.7/5.8 but is one unique endpoint). Exactly six allowlisted pre-existing extension routes are permitted; unreviewed routes or authorization downgrades fail. Parameter *names* can differ while keeping equivalent matching paths; signatures are compared by their URL structure.
2. **Fail-closed static route inspector**: `scripts/verify-api-contracts.mjs` checks method/path coverage, route uniqueness, required authentication and role declarations, URL parameter and request-body/query Zod boundaries, and Swagger security metadata on protected/public/optional endpoints. This checks declarative source and **does not prove service functionality or ownership rules**.
3. **Swagger security annotations**: added `@ApiBearerAuth()` to protected controllers/operations; no bearer requirement is annotated on anonymous/public routes, provider webhooks or optional authenticated behavior events. No existing route's authorization guard was relaxed.
4. **Input boundary fixes**: `ProductSlugSchema` validates the existing lowercase Catalog-generated 240-character slug format at `GET /products/:slug`; `PaymentProviderIdentifierSchema` sanitizes provider IDs at `POST /payments/webhooks/:provider`. Both use the existing Zod 4 shared contract package. Verified provider selection and webhook signatures still belong to the provider registry/payment service.
5. **Security regression tests**: `scripts/tests/api-contracts-guards.test.mjs` creates isolated source fixtures to prove the static guard catches missing routes, unprotected endpoints, missing RBAC, missing Zod validation and incorrect public/OpenAPI bearer annotations. `apps/api/test/unit/api-contracts-http-boundaries.spec.ts` covers JWT header shape, optional authentication, RBAC and Zod validation at runtime.
6. **Live integration acceptance**: `apps/api/scripts/verify-api-contracts-api-runtime.ts` boots the actual NestJS monolith against a local dedicated `_test` PostgreSQL database, checks generated OpenAPI security on 74 operations, verifies missing-token 401 on protected routes, authenticates unique Buyer/Seller accounts, probes role denial, address ownership, refresh token rotation, invalid input and error envelopes. It creates three unique user fixtures and does not delete or reset a database. This script is *not* a substitute for the complete 74-route positive/negative functional test matrix, which continues in the domain-specific passes.
7. **CI and ordered runner**: `pnpm verify:api-contracts`, `pnpm test:api-contracts:guards`, `pnpm acceptance:api-contracts`, `pnpm --filter @tradenest/api verify:api-contracts:runtime`, and `.github/workflows/api-auth-contracts.yml`.

## Run — on approved locked environment

```bash
nvm use 24
corepack enable
corepack prepare pnpm@10.15.1 --activate

# Required genuine registry-resolved pnpm-lock.yaml must already be committed
export TEST_DATABASE_URL='postgresql://tradenest:tradenest_local_only@127.0.0.1:5432/tradenest_test?schema=public'
export DATABASE_URL="$TEST_DATABASE_URL"
export NODE_ENV=test
export JWT_ACCESS_SECRET='local-api contracts-test-jwt-secret-at-least-32-characters'
export PAYMENT_SANDBOX_WEBHOOK_SECRET='local-api contracts-test-webhook-secret-at-least-32-characters'
export CATALOG_DEFAULT_CURRENCY=USD

pnpm verify:api-contracts
pnpm test:api-contracts:guards
pnpm acceptance:api-contracts
```

`acceptance:api-contracts` is fail-closed: first Api contracts source checks, then Foundation locked foundation acceptance and guarded isolated PostgreSQL 18 Database acceptance, then builds, lint/typecheck, Jest unit and integration suites, live NestJS/OpenAPI/JWT/RBAC HTTP integration, and final architecture check. It refuses non-test or non-local PostgreSQL targets. The pass is **not signed off** unless every stage passes; unit tests are never reported as passed solely because their files exist.

## Out-of-scope items intentionally deferred

Real external payment processing, provider refund reconciliation, S3/Cloudinary uploads, full admin write management, notifications, inventory expiration and complete product/checkout/payment/dispute lifecycle end-to-end tests require their own end-to-end capability verification. The controller/SWAGGER declarations verified here are **not** a guarantee that every declared endpoint is functionally complete. Ownership for other resources also needs corresponding domain integration verification in other capabilities.

## Local preparation results

- Dependency-free Api contracts route security scan: **74/74 expected; 6 extra; 80 controller operations — PASSED**.
- Eight negative-regression tests for route/guard/swagger/RBAC/Zod scanning: **PASSED**.
- Original architecture checker: **re-run required before packaging; results recorded separately**.
- TypeScript unit/integration and live PostgreSQL runtime tests: **NOT RUN** (the preparation environment contains Node.js 22, no pnpm or Docker and lacks a true `pnpm-lock.yaml`).
