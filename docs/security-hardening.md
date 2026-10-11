# TradeNest — Security: Security Hardening, Complete Regression Testing & CI Enforcement

## Baseline and immutability

This pass extends **TradeNest Payment compliance** without changing the original 21-page Technical Blueprint, `SPEC_LOCK.yaml`, Prisma schema, historical migrations, NestJS `AppModule`, or Docker topology. The locked Next.js 16/React/TypeScript, Node.js 24/NestJS modular monolith, PostgreSQL 18/Prisma 7, Zod 4, Python/FastAPI, Tailwind/shadcn and pnpm 10.15.1 selections remain unchanged. No public NestJS endpoint or database table has been added.

## Actual code changes

1. **Cookie-based CSRF defense (`apps/web/lib/mutation-origin.ts`)**: all Next.js proxy mutations and session mutations enforce exact same-origin `Origin` and Fetch Metadata. Cross-origin, same-site sibling subdomains, `Origin: null`, malformed origins, and mutations with no trustworthy browser-origin signal are denied (403). Safe GETs remain available. The proxy checks this before touching upstream credentials or the NestJS API.
2. **Test-route hardening**: the existing Playwright-only session probe refuses to activate in production and only calls a loopback HTTP API when explicitly enabled for local tests.
3. **NestJS response hardening**: remove the `X-Powered-By` header and set `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin` without adding dependencies.
4. **Negative regression tests**: 20 new pure Node tests execute the actual browser boundary implementation, including hostile-origin and session guard assertions. Playwright includes malicious mutation probes and cross-role buyer access denial against the running application.
5. **Full-stack CI**: `.github/workflows/security-regression.yml` requires architecture/route/migration compliance, frozen `pnpm-lock.yaml` installation, Node 24, pnpm 10.15.1, PostgreSQL 18, migration execution, typechecking/lint/build, NestJS unit/integration tests, FastAPI tests and browser Playwright tests. Missing dependencies or failing tests cause CI failure. A guarded database creation tool permits only localhost `tradenest_test` and `tradenest_e2e`.
6. **Security acceptance**: `pnpm verify:security` runs Security source checks and executable security tests; `pnpm acceptance:security` reruns cumulative source tests, invokes the entire earlier Payment compliance live acceptance chain, and then requires NestJS, PostgreSQL, Playwright, and AI tests. Acceptance fails closed on missing prerequisites.

## Executed evidence (this artifact-building environment)

| Check | Actual observed result |
|---|---|
| Architecture checker | **SELLER INTELLIGENCE/11** |
| Blueprint API declarations | **PASS 74/74** (19 existing extensions) |
| Security source guard checks | **ADMIN/9** |
| Cumulative dependency-free Node tests | **PASS 140/140**, including 20 Security tests |
| Python/FastAPI test suite | **PASS 23/23** |
| TypeScript/TSX syntax parse | **PASS 411 files**, zero syntax diagnostics; **not** a typecheck |
| Historical migrations baseline | **PASS** static SHA/mapping checks; **not** a migration execution |
| Full Security acceptance | **BLOCKED**: Node v22.16.0, no pnpm, no Docker/PostgreSQL, no authentic `pnpm-lock.yaml`, no external test credentials |
| NestJS/Jest, Playwright, full TypeScript build | **NOT RUN** in required runtime |
| Stripe and S3 signed live tests | **NOT RUN** |

## Release and operational notes

- **Production remains not approved**. Passing source tests is not live acceptance.
- Browser POST/PATCH/DELETE calls to the Next.js proxy and session routes must supply the real web origin (normal browser fetches do this) or trusted same-origin Fetch Metadata. A reverse proxy must preserve the public request host and scheme as observed by Next.js. Test with your final TLS deployment configuration before enabling traffic.
- Direct NestJS REST clients keep using bearer JWTs; the browser's origin check does **not** replace backend JWT, RBAC, ownership, payment webhook signature checks, or financial idempotency.
- The new Playwright login/session test helper remains development-only and must never be activated in production.
- The existing manual workflow `.github/workflows/lockfile-bootstrap.yml` generates an authentic lockfile with registry access; **review and commit** the file. Do not invent lockfile contents.
- `pnpm acceptance:security` requires successful prerequisite acceptance suites; the full release still separately needs production payment/escrow regulatory approval and Operations deployment readiness.

## Changed baseline files

- `apps/api/src/main.ts`
- `apps/web/app/api/__e2e/session/route.ts`
- `apps/web/app/api/session/login/route.ts`
- `apps/web/app/api/session/logout-all/route.ts`
- `apps/web/app/api/session/logout/route.ts`
- `apps/web/app/api/session/register-seller/route.ts`
- `apps/web/app/api/session/register/route.ts`
- `apps/web/app/api/tradenest/[...path]/route.ts`
- `package.json`

## New Security files

- `.github/workflows/security-regression.yml`
- `apps/web/e2e/security-security-boundaries.spec.ts`
- `apps/web/lib/mutation-origin.ts`
- `scripts/create-security-test-database.mjs`
- `scripts/accept-security.mjs`
- `scripts/tests/security-guards.test.mjs`
- `scripts/verify-security.mjs`

No baseline files were deleted. At the time of this audit, the original blueprint, `SPEC_LOCK.yaml`, schema, migrations and deployment topology remain byte-for-byte unchanged.
