# Patch 00 — TradeNest UI baseline (before visual changes)

This document describes **environment verification and evidence capture only**. Patch 00 does
not modify the marketplace UI, auth, payments, escrow, inventory, or business rules. The
source of truth remains the TradeNest Technical Blueprint and the code in this repository.

## Run from the repository root (WSL/Linux/macOS terminal)

1. Use **Node.js 24** (`.nvmrc`) and **pnpm 10.15.1** (`package.json`). If you use `nvm`,
   run `nvm install 24 && nvm use 24`. Ensure pnpm is installed at the pinned version
   (for example, `corepack enable && corepack prepare pnpm@10.15.1 --activate`
   where Corepack is available). Confirm with `node -v && pnpm -v`.
2. Install dependencies **from the committed lockfile**: `pnpm install --frozen-lockfile`.
   The runner never installs or upgrades dependencies automatically.
3. Inspect prerequisites without touching databases: `pnpm qa:baseline --preflight`.
4. Record the **static + build baseline**: `pnpm qa:baseline`. This runs architecture
   and frontend source checks, frontend regression tests, web typecheck, lint, and a
   production build. A failing check is recorded as FAIL; a missing dependency is
   recorded as BLOCKED, never silently treated as a pass.
5. Read `.tradenest-qa/latest.json`, or share its non-secret results with your team.
   Individual timestamped reports preserve baseline history.

### Optional: capture a real browser baseline (test database ONLY)

Requires Docker, local PostgreSQL and installed Playwright Chromium browsers. **Do not
use a production, staging or development database.** The E2E setup seeds and mutates
its target database to exercise the app. It only runs when explicitly requested.

```bash
pnpm infra:up
export TEST_DATABASE_URL='postgresql://tradenest:tradenest_local_only@127.0.0.1:5432/tradenest_e2e_test'
node scripts/prepare-test-database.mjs
export E2E_DATABASE_URL="$TEST_DATABASE_URL"
pnpm --filter @tradenest/web exec playwright install chromium
pnpm qa:baseline --screenshots
```

The screenshot option runs the actual integration-backed E2E workflow and captures
representative screens at 375px, 820px and 1440px into
`.tradenest-qa/screenshots/`: public home/explore/login, Buyer cart/orders,
Seller overview/products, Admin overview/users. **These are visual baselines**, not
pass/fail approval of responsiveness, visual quality, accessibility, or every page.
Patch 17 later expands automated browser coverage across all required breakpoints.

To run E2E without extra screenshots, use `pnpm qa:baseline --e2e` after the same
isolated database setup. E2E requires the local database reachable on loopback and
named `tradenest_*_e2e` / `tradenest_*_test`. No production database URL is accepted
by this runner. The existing Playwright runner also checks for a test database name.

## Expected outcomes and troubleshooting

| Observation | Meaning / next action |
| --- | --- |
| `Node.js 24 required` | Wrong **host/WSL** runtime; install/select Node 24 in the terminal where you run the app. |
| `pnpm 10.15.1 required` | Use the pinned package manager version, not whichever pnpm happens to be globally installed. |
| `workspace dependencies missing` | Run `pnpm install --frozen-lockfile` from the repository root. |
| `E2E_DATABASE_URL is not set` | Browser run was explicitly requested without a test database URL. |
| `Playwright ... FAIL` | Read console and Playwright's `test-results/`; the baseline does **not** auto-fix code. |
| `SKIPPED` browser baseline | Expected with the default command; it is not proof that the interface works on phones. |

**Notes:** Run commands inside the same WSL/Linux environment as Node and the source
checkout if developing via WSL. Docker PostgreSQL is a separate **container**, not
part of WSL or a production cloud database. Screenshots, reports and test data are
local outputs ignored by Git via `.tradenest-qa/`.

## Patch 00 acceptance gate

- Scripts and documentation apply cleanly to the original TradeNest source.
- `--help` and `--preflight` work with only Node installed; no app start is required.
- Baseline reports show blocked vs failed vs passed vs skipped truthfully.
- `--screenshots` cannot target a non-local/non-test database via the baseline runner.
- Later UI patches do not begin until available verification gaps are documented.
