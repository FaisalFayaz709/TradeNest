/** Create only an explicitly named local E2E database; used by CI after frozen install. */
import { createRequire } from 'node:module';
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { Client } = require('pg');
const source = process.env.DATABASE_URL;
const target = process.env.E2E_DATABASE_URL;
if (!source || !target) throw new Error('DATABASE_URL and E2E_DATABASE_URL are required');
const admin = new URL(source);
const e2e = new URL(target);
if (!['localhost', '127.0.0.1', '[::1]'].includes(admin.hostname) ||
  e2e.hostname !== admin.hostname || admin.port !== e2e.port ||
  admin.pathname.replace('/', '') !== 'tradenest_test' ||
  e2e.pathname !== '/tradenest_e2e') {
  throw new Error('Refusing to create a database outside the local, isolated tradenest_test/tradenest_e2e pair');
}
const client = new Client({ connectionString: source });
await client.connect();
try {
  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', ['tradenest_e2e']);
  if (existing.rowCount === 0) {
    await client.query('CREATE DATABASE tradenest_e2e');
  }
  console.log('Security E2E PostgreSQL 18 database is available (isolated local database).');
} finally {
  await client.end();
}
