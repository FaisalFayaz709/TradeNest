/**
 * Database acceptance. Requires Foundation locked toolchain, real frozen lockfile,
 * and Docker PostgreSQL 18. Always targets a dedicated local *_test database.
 * Does not reset or migrate the development/production database.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
function run(label, cmd, args, env = {}) {
  console.log(`\nDATABASE: ${label}`);
  const result = spawnSync(cmd, args, {
    cwd: root, stdio: 'inherit', shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  });
  if (result.error || result.status !== 0) {
    console.error(`DATABASE BLOCKED at "${label}". All later checks are NOT VERIFIED.`);
    process.exit(result.status && result.status !== 0 ? result.status : 1);
  }
}
run('verify protected migration history and model/table mapping', process.execPath, [resolve(root, 'scripts/verify-database-migration-chain.mjs')]);
run('dependency-free target and migration guard regression tests', process.execPath, ['--test', resolve(root, 'scripts/tests/database-guards.test.mjs')]);
run('refuse non-test and non-local database URLs', process.execPath, [resolve(root, 'scripts/verify-database-target.mjs')]);
const dbEnv = { DATABASE_URL: process.env.TEST_DATABASE_URL, NODE_ENV: 'test' };
run('locked Node/pnpm/Docker/toolchain and real lockfile', process.execPath, [resolve(root, 'scripts/verify-foundation-environment.mjs')], dbEnv);
run('frozen workspace dependency installation', 'pnpm', ['install', '--frozen-lockfile'], dbEnv);
run('modular-monolith architectural verification', 'pnpm', ['verify:architecture'], dbEnv);
run('start local PostgreSQL 18 container', 'docker', ['compose', 'up', '-d', 'postgres'], dbEnv);
// PostgreSQL may be started but not yet accepting connections after `up -d`.
let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
  const result = spawnSync('docker', ['compose', 'exec', '-T', 'postgres',
    'sh', '-c', 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], {
    cwd: root, stdio: 'ignore', shell: process.platform === 'win32',
  });
  if (result.status === 0) { ready = true; break; }
  spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 1000)'], { stdio: 'ignore' });
}
if (!ready) { console.error('DATABASE BLOCKED: PostgreSQL container is not ready.'); process.exit(1); }
run('create dedicated test database if missing (never drop)', process.execPath, [resolve(root, 'scripts/prepare-test-database.mjs')], dbEnv);
run('Prisma 7 schema validation', 'pnpm', ['db:validate'], dbEnv);
run('generate Prisma 7 Client', 'pnpm', ['db:generate'], dbEnv);
run('build shared config contracts for database verifier', 'pnpm', ['--filter', '@tradenest/config', 'build'], dbEnv);
run('apply historical migrations to isolated test database', 'pnpm', ['db:migrate:deploy'], dbEnv);
run('verify Prisma migration history is current', 'pnpm', ['db:migrate:status'], dbEnv);
run('verify blueprint tables, indexes and CHECK constraints', 'pnpm', ['db:foundation:verify'], dbEnv);
run('execute live PostgreSQL integrity, rollback and concurrency tests', 'pnpm', ['--filter', '@tradenest/api', 'db:database:verify'], dbEnv);
run('verify architecture unchanged after Database', 'pnpm', ['verify:architecture'], dbEnv);
console.log('\nTRADENEST DATABASE ACCEPTANCE PASSED for isolated PostgreSQL 18 database.');
console.log('This does not certify Foundation unless its separate acceptance also passes, or any later application feature passes.');
