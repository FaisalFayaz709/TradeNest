# Foundation — locked foundation, environment and reproducible dependencies

**Delivery status: PARTIALLY IMPLEMENTED; NOT ACCEPTED.**

## Source of truth and scope

The original `source/TradeNest_Technical_Blueprint.pdf` and `SPEC_LOCK.yaml` retain full authority. Foundation **does not** refactor application modules, change REST endpoints, edit payment/order/escrow state machines, relax RBAC, replace Tailwind/shadcn, change the ORM, or alter the Next.js + NestJS modular-monolith topology.

This pass adds fail-closed, dependency-free environment checks, an ordered acceptance command, and a reproducible lockfile-generation procedure. It leaves unresolved Database+ features untouched.

## Verified from the original repository

- `.nvmrc` specifies **24**, `package.json` requires Node **>=24.0.0 <25** and pins `packageManager` to **pnpm@10.15.1**.
- The single pnpm workspace and Docker Compose PostgreSQL **18** development service exist. The local volume target was corrected from the pre-18 `/var/lib/postgresql/data` to `/var/lib/postgresql`, matching the PostgreSQL 18 official image; the deployment Compose file already used the correct location. **For any existing database volume, back up data and inspect the on-disk structure before reusing it or running `docker compose down -v`.**
- Prisma ORM **7** configuration, TypeScript workspace modules, Next.js **16** and NestJS application are already represented in the source.
- `services/ai/requirements.lock` exists; FastAPI Python versions are constrained by `services/ai/pyproject.toml`.
- `pnpm-lock.yaml` was **not present** in the supplied ZIP. Generating a real lockfile requires working pnpm 10.15.1 and registry resolution. **Do not create a dummy lockfile.**

## Local preparation (run once on a machine with package-registry access)

```bash
# Must use the installed nvm for Node.js; if not installed, install nvm first.
nvm install 24
nvm use 24
node --version  # must be 24.x

# Corepack is used only to activate the locked pnpm release.
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm --version  # must print 10.15.1

# Verify the pinned toolchain BEFORE generating the first lockfile.
node scripts/verify-foundation-environment.mjs --toolchain-only

# In the repository ROOT, resolve dependency tree exactly once.
pnpm install --lockfile-only
# Review pnpm-lock.yaml: all importers, version 9.0, no unexpected registry overrides.
# Commit the reviewed file together with the source tree.

# Future installs must be fully frozen:
pnpm install --frozen-lockfile
```

This command records the **resolved** dependencies; manifest versions are not pinned from the original archive. Freezing the lockfile is essential before claiming reproducibility. Review the generated dependency tree for security and compatibility independently.

## Local environment and acceptance

```bash
# Install Docker Engine/Desktop with the Docker Compose plugin. Ensure it is running.
# Install Python 3.13 (the deployed AI image uses 3.13).

cp .env.example .env
cp apps/api/.env.example apps/api/.env
# Set safe local secrets and a LOCAL database in both files, never production secrets. The Foundation preflight deliberately rejects non-loopback DB hosts.
export DATABASE_URL='postgresql://tradenest:tradenest_local_only@127.0.0.1:5432/tradenest?schema=public'

# Requires the reviewed pnpm-lock.yaml and external network/dependency installation:
pnpm verify:foundation:environment
pnpm acceptance:foundation
```

`acceptance:foundation` runs, in order: environment + lockfile checks → frozen `pnpm install` → architecture verification → PostgreSQL 18 Compose startup and readiness → Prisma generation/validation → workspace typecheck/lint/build → AI pytest without generated caches → final architecture verification. It stops immediately on a failed requirement. The runner does **not** migrate production databases, seed sensitive data, or claim database feature completeness (that is Database).

GitHub Actions has a matching `foundation.yml` workflow using Node 24, pnpm 10.15.1, Python 3.13 and PostgreSQL 18 via Compose. That job **will fail until the genuine lockfile is committed**. Do not remove the fail-closed check to make a green workflow.

## Acceptance ledger — execution environment for this archive

| Check | Result | Reason |
|---|---|---|
| Original architecture verifier | PASSED | Runs as source-level static checker under available Node 22 |
| Locked Node 24/pnpm 10.15.1 runtime | BLOCKED | Available runtime Node 22; pnpm not installed |
| Real pnpm shared lockfile | BLOCKED | Absent in input; package registry unreachable; must not fabricate |
| Docker Compose with PostgreSQL 18 | BLOCKED | Docker not available in archive assembly environment |
| Workspace frozen install / Prisma generate / typecheck / lint / build | NOT RUN | Cannot resolve/install dependencies in the assembly environment |
| Python service tests | PASSED | 19 passed using installed Python 3.13.5 and pytest |
| Foundation acceptance | **NOT PASSED** | Required runtime and lockfile cannot be validated here |

## Foundation sign-off conditions

- [ ] Node.js exactly 24 and pnpm exactly 10.15.1, Python compatible, Docker and Compose available.
- [ ] `pnpm-lock.yaml` actually generated under the locked toolchain, reviewed and committed.
- [ ] `pnpm install --frozen-lockfile` succeeds with no lockfile modifications.
- [ ] PostgreSQL 18 starts and becomes healthy.
- [ ] Architecture verifier, Prisma generate/validate, typecheck, lint, build and AI tests pass.
- [ ] `pnpm acceptance:foundation` completes successfully with preserved blueprint, SPEC_LOCK and no unrelated feature changes.

Only when **every item** is verified may this pass be marked completed. Later passes still require their own testing.
