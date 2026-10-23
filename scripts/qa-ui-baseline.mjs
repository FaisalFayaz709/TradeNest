/**
 * Patch 00: non-destructive, local UI baseline runner.
 *
 * Default: static verification + web typecheck/lint/build, with truthful BLOCKED
 * statuses when dependencies are unavailable. --e2e opts into a TEST database
 * and browser tests; --screenshots additionally captures visual baselines.
 * Reports contain tool versions, file hashes, and results, never env secrets.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = join(root, '.tradenest-qa');
const args = new Set(process.argv.slice(2));
const recognized = new Set(['--preflight', '--e2e', '--screenshots', '--help']);
const unknown = [...args].filter((arg) => !recognized.has(arg));
if (args.has('--help')) {
  console.log(`TradeNest Patch 00 baseline\n\nUsage:\n  node scripts/qa-ui-baseline.mjs [--preflight] [--e2e] [--screenshots]\n\n  --preflight    Only inspect environment (no build or database writes).\n  --e2e          Opt into Playwright workflows against an isolated local test database.\n  --screenshots  Also capture buyer/seller/admin visual baselines (implies --e2e).\n\nOutputs: .tradenest-qa/baseline-<timestamp>.json and latest.json\n`);
  process.exit(0);
}
if (unknown.length) {
  console.error(`Unknown option(s): ${unknown.join(', ')}. See --help.`);
  process.exit(2);
}
if (args.has('--preflight') && (args.has('--e2e') || args.has('--screenshots'))) {
  console.error('--preflight cannot be combined with --e2e or --screenshots.');
  process.exit(2);
}

const wantsE2E = args.has('--e2e') || args.has('--screenshots');
const wantsScreenshots = args.has('--screenshots');
const now = new Date().toISOString();
const results = [];
function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    cwd: root,
    encoding: options.stdio === 'inherit' ? undefined : 'utf8',
    stdio: options.stdio ?? 'pipe',
    shell: process.platform === 'win32',
    env: { ...process.env, ...options.env },
  });
}
function hash(path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) return null;
  return createHash('sha256').update(readFileSync(absolute)).digest('hex');
}
function localTestDatabase() {
  const raw = process.env.E2E_DATABASE_URL;
  if (!raw) return { ok: false, reason: 'E2E_DATABASE_URL is not set' };
  try {
    const url = new URL(raw);
    const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        !/^tradenest(?:_[a-z0-9]+)*_(?:e2e|test)(?:_test)?$/.test(name)) {
      return { ok: false, reason: 'E2E_DATABASE_URL must target loopback PostgreSQL and a clearly named tradenest_*_e2e/test database' };
    }
    return { ok: true, databaseName: name };
  } catch {
    return { ok: false, reason: 'E2E_DATABASE_URL is not a valid PostgreSQL URL' };
  }
}
function record(name, status, more = {}) {
  results.push({ name, status, ...more });
  console.log(`[${status}] ${name}${more.reason ? ` — ${more.reason}` : ''}`);
}
function check(name, command, commandArgs, blockReason = null, env = {}) {
  if (blockReason) { record(name, 'BLOCKED', { reason: blockReason }); return; }
  console.log(`\n>>> ${name}`);
  const started = Date.now();
  const result = run(command, commandArgs, { stdio: 'inherit', env });
  record(name, result.status === 0 && !result.error ? 'PASS' : 'FAIL', {
    exitCode: result.status,
    durationMs: Date.now() - started,
    ...(result.error ? { reason: result.error.message } : {}),
  });
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
const nodeOk = nodeMajor === 24;
const pnpmResult = run('pnpm', ['--version']);
const pnpmVersion = !pnpmResult.error && pnpmResult.status === 0 ? pnpmResult.stdout.trim() : null;
const pnpmOk = pnpmVersion === '10.15.1';
const installed = existsSync(join(root, 'node_modules', '.pnpm'));
const lockfile = existsSync(join(root, 'pnpm-lock.yaml'));
const toolBlock = [
  !nodeOk && 'Node.js 24 required (see .nvmrc)',
  !pnpmOk && `pnpm 10.15.1 required (found ${pnpmVersion ?? 'not installed'})`,
  !installed && 'workspace dependencies missing: run pnpm install --frozen-lockfile',
  !lockfile && 'pnpm-lock.yaml missing',
].filter(Boolean).join('; ') || null;
const database = localTestDatabase();
console.log(`TradeNest UI baseline • Node ${process.versions.node} • pnpm ${pnpmVersion ?? 'missing'}`);
console.log(`Toolchain: ${toolBlock ?? 'ready'}${wantsE2E ? ` • E2E database: ${database.ok ? database.databaseName : database.reason}` : ''}`);
if (args.has('--preflight')) {
  record('Node 24 / pnpm 10.15.1 / locked workspace dependencies', toolBlock ? 'BLOCKED' : 'PASS', toolBlock ? { reason: toolBlock } : {});
  record('Browser database', wantsE2E ? database.ok ? 'PASS' : 'BLOCKED' : 'SKIPPED',
    wantsE2E && !database.ok ? { reason: database.reason } : {});
} else {
  // These tests can still run without pnpm, distinguishing existing findings from blockers.
  check('Locked architecture source verification', process.execPath, ['scripts/verify-architecture.mjs']);
  check('Frontend source verification', process.execPath, ['scripts/verify-frontend.mjs']);
  check('Frontend source regression tests', process.execPath,
    ['--experimental-strip-types', '--test', 'scripts/tests/frontend-integration.test.mjs']);
  check('Next.js TypeScript typecheck', 'pnpm', ['--filter', '@tradenest/web', 'typecheck'], toolBlock);
  check('Next.js ESLint', 'pnpm', ['--filter', '@tradenest/web', 'lint'], toolBlock);
  check('Next.js production build', 'pnpm', ['--filter', '@tradenest/web', 'build'], toolBlock);
  if (wantsE2E) {
    const blocker = toolBlock || (!database.ok ? database.reason : null);
    check(wantsScreenshots ? 'Playwright workflows + visual screenshot capture' : 'Playwright workflows',
      'pnpm', ['test:e2e'], blocker,
      wantsScreenshots ? { TRADENEST_CAPTURE_BASELINE: '1' } : {});
  } else {
    record('Playwright browser / screenshot baseline', 'SKIPPED', { reason: 'Opt-in: use --e2e or --screenshots with a local isolated E2E database' });
  }
}
const report = {
  patch: '00', generatedAt: now, platform: process.platform, node: process.version,
  pnpm: pnpmVersion, dependencyDirectoryPresent: installed, e2eRequested: wantsE2E,
  screenshotCaptureRequested: wantsScreenshots,
  e2eDatabaseName: wantsE2E && database.ok ? database.databaseName : null,
  hashes: Object.fromEntries(['package.json', 'pnpm-lock.yaml', 'apps/web/playwright.config.ts',
    'apps/web/app/globals.css', 'apps/web/components/site-header.tsx'].map((p) => [p, hash(p)])),
  results,
  // No JWTs, passwords, database URLs, cookies or environment variable values.
};
mkdirSync(outDir, { recursive: true });
const file = `baseline-${now.replace(/[:.]/g, '-')}.json`;
writeFileSync(join(outDir, file), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(outDir, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nEvidence saved: .tradenest-qa/${file}`);
const bad = results.filter((result) => result.status === 'FAIL' || result.status === 'BLOCKED');
console.log(`Summary: ${results.filter((r) => r.status === 'PASS').length} passed, ${bad.length} failed/blocked, ${results.filter((r) => r.status === 'SKIPPED').length} skipped.`);
process.exitCode = bad.length ? 1 : 0;
