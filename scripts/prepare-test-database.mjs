/**
 * Creates a dedicated database in the local Docker PostgreSQL 18 service,
 * without dropping, resetting or mutating the development/production database.
 */
import { spawnSync } from 'node:child_process';
const url = new URL(process.env.TEST_DATABASE_URL);
const name = decodeURIComponent(url.pathname.slice(1));
if (!/^tradenest(?:_[a-z0-9]+)*_test$/.test(name) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
  console.error('Refusing to create any database without a validated loopback *_test target.');
  process.exit(1);
}
const run = (sql) => {
  const command = ['compose', 'exec', '-T', 'postgres', 'sh', '-c',
    'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "$1"', 'sh', sql];
  const result = spawnSync('docker', command, { encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.error || result.status !== 0) {
    console.error(result.stderr || String(result.error || 'docker compose exec failed'));
    process.exit(1);
  }
  return result.stdout.trim();
};
const exists = run(`SELECT 1 FROM pg_database WHERE datname = '${name}'`);
if (exists === '1') console.log(`DATABASE: Test database ${name} already exists. No reset performed.`);
else {
  run(`CREATE DATABASE "${name}"`);
  console.log(`DATABASE: Created local isolated database ${name}.`);
}
