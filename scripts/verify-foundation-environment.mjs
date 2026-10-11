/**
 * TradeNest Foundation locked-environment preflight (no third-party dependencies).
 * The original blueprint and SPEC_LOCK.yaml are authoritative.
 * This tool deliberately fails closed; --toolchain-only is solely for generating
 * the first reviewed lockfile, NEVER for certifying Foundation acceptance.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const toolchainOnly = process.argv.includes('--toolchain-only');
const errors = [];
const info = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');

function requireMatch(path, expression, description) {
  if (!existsSync(resolve(root, path)) || !expression.test(read(path))) {
    errors.push(`${description}: missing or inconsistent (${path}).`);
  }
}
function command(bin, args, description, matcher) {
  const result = spawnSync(bin, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
  const message = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (result.error || result.status !== 0) {
    errors.push(`${description}: not available or failed (${result.error?.code ?? `exit ${result.status}`}).`);
    return;
  }
  if (matcher && !matcher.test(message)) errors.push(`${description}: unexpected version/output: ${message.split('\n')[0]}.`);
  else info.push(`${description}: ${message.split('\n')[0]}.`);
}

const pkg = JSON.parse(read('package.json'));
if (pkg.packageManager !== 'pnpm@10.15.1') errors.push('packageManager must be pnpm@10.15.1.');
if (pkg.engines?.node !== '>=24.0.0 <25') errors.push('Node.js engines must remain >=24.0.0 <25.');
if (process.versions.node.split('.')[0] !== '24') errors.push(`Node.js 24 required; found ${process.version}.`);
requireMatch('.nvmrc', /^24\s*$/, 'Node.js 24 version pin');
requireMatch('.npmrc', /^engine-strict=true\s*$/m, 'strict engine enforcement');
requireMatch('SPEC_LOCK.yaml', /pattern: "modular monolith"/, 'source architecture lock');
requireMatch('docker-compose.yml', /image: postgres:18(?:\s|$)/, 'local PostgreSQL 18 image');
requireMatch('pnpm-workspace.yaml', /^packages:\s*$/m, 'pnpm workspace declaration');
command('pnpm', ['--version'], 'pnpm', /^10\.15\.1\s*$/);

if (!toolchainOnly) {
  if (!existsSync(resolve(root, 'pnpm-lock.yaml'))) {
    errors.push('pnpm-lock.yaml is missing. Under Node 24/pnpm 10.15.1 run `pnpm install --lockfile-only`, review the result, then commit it.');
  } else {
    const lock = read('pnpm-lock.yaml');
    if (!/^lockfileVersion:\s*['"]?9\.0['"]?\s*$/m.test(lock) || !/^importers:\s*$/m.test(lock)) {
      errors.push('pnpm-lock.yaml is not in the expected pnpm 10 shared-workspace format.');
    }
    for (const importer of ['.', 'apps/api', 'apps/web', 'packages/config', 'packages/contracts', 'packages/ui']) {
      if (!lock.includes(`  ${importer}:`)) errors.push(`pnpm-lock.yaml is missing workspace importer: ${importer}.`);
    }
  }
  command('docker', ['--version'], 'Docker CLI', /Docker version/i);
  command('docker', ['compose', 'version'], 'Docker Compose', /Docker Compose version/i);
  command('docker', ['info', '--format', '{{.ServerVersion}}'], 'Docker engine', /^\d+\.\d+/);
  command('python', ['--version'], 'Python', /^Python 3\.(?:12|13)\.\d+/);
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL must be explicitly exported for local Prisma/PostgreSQL checks; never use a production database here.');
  } else {
    try {
      const parsed = new URL(process.env.DATABASE_URL);
      if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) errors.push('DATABASE_URL must use PostgreSQL.');
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) {
        errors.push('Foundation accepts LOCAL PostgreSQL URLs only; never run this acceptance command against staging/production.');
      }
      if (/prod(?:uction)?|staging/i.test(parsed.pathname)) {
        errors.push('Foundation refuses production/staging database names.');
      }
    } catch { errors.push('DATABASE_URL is not a valid PostgreSQL connection URL.'); }
  }
}

if (errors.length) {
  console.error(`TRADENEST FOUNDATION ${toolchainOnly ? 'TOOLCHAIN' : 'ENVIRONMENT'}: BLOCKED`);
  for (const problem of errors) console.error(`- ${problem}`);
  process.exit(1);
}
console.log(`TRADENEST FOUNDATION ${toolchainOnly ? 'TOOLCHAIN' : 'ENVIRONMENT'}: VERIFIED`);
for (const item of info) console.log(`- ${item}`);
if (toolchainOnly) console.log('TOOLCHAIN CHECK ONLY: this does NOT certify Foundation or validate a dependency lockfile.');
