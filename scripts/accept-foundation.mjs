/**
 * Foundation acceptance runner. Must run on Node 24 + pnpm 10.15.1 with Docker.
 * Fail closed on every command; do not change architecture or dependencies.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
function run(label, executable, args) {
  console.log(`\nFOUNDATION: ${label}`);
  const result = spawnSync(executable, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  if (result.error || result.status !== 0) {
    console.error(`FOUNDATION FAILED at '${label}'. All subsequent checks are NOT VERIFIED.`);
    process.exit(result.status && result.status !== 0 ? result.status : 1);
  }
}
run('locked environment and reviewed lockfile', process.execPath, [resolve(root, 'scripts/verify-foundation-environment.mjs')]);
run('frozen dependency installation', 'pnpm', ['install', '--frozen-lockfile']);
run('modular-monolith / SPEC_LOCK architecture', 'pnpm', ['verify:architecture']);
run('PostgreSQL 18 container startup', 'docker', ['compose', 'up', '-d', 'postgres']);
let ready = false;
for (let attempt = 0; attempt < 20; attempt++) {
  const check = spawnSync('docker', ['compose', 'exec', '-T', 'postgres', 'sh', '-c', 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], {
    cwd: root, stdio: 'ignore', shell: process.platform === 'win32',
  });
  if (check.status === 0) { ready = true; break; }
  // Sleep via sync child; do not use busy waiting.
  spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 1000)'], { stdio: 'ignore' });
}
if (!ready) {
  console.error('FOUNDATION FAILED: PostgreSQL 18 container never reached pg_isready.');
  process.exit(1);
}
console.log('FOUNDATION: PostgreSQL 18 is accepting connections.');
run('Prisma 7 client generation', 'pnpm', ['db:generate']);
run('Prisma schema validation', 'pnpm', ['db:validate']);
run('workspace TypeScript checks', 'pnpm', ['typecheck']);
run('workspace lint', 'pnpm', ['lint']);
run('workspace build', 'pnpm', ['build']);
run('Python AI tests (without generated caches)', 'python', ['-B', '-m', 'pytest', '-p', 'no:cacheprovider', 'services/ai/tests']);
run('final architecture verification after tests', 'pnpm', ['verify:architecture']);
console.log('\nTRADENEST FOUNDATION ACCEPTANCE PASSED (locked environment, frozen install, PostgreSQL readiness, architecture, generate, validate, typecheck, lint, build, AI tests).');
console.log('Foundation acceptance does not certify payments, storage, or full end-to-end deployment.');
