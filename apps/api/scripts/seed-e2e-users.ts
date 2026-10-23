import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { hash } from 'bcrypt';
import { Client } from 'pg';

const connectionString = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('E2E_DATABASE_URL (or DATABASE_URL) is required.');
const databaseName = new URL(connectionString).pathname.replace(/^\//, '').toLowerCase();
if (!databaseName.includes('e2e') && !databaseName.includes('test')) {
  throw new Error(`Refusing to seed E2E fixtures into non-test database: ${databaseName}`);
}

const password = process.env.E2E_SHARED_PASSWORD ?? 'TradeNest-E2E-Only-2026!';
const fixtures = [
  { email: process.env.E2E_BUYER_EMAIL ?? 'e2e.buyer@tradenest.invalid', name: 'E2E Buyer', role: 'BUYER' },
  { email: process.env.E2E_SELLER_EMAIL ?? 'e2e.seller@tradenest.invalid', name: 'E2E Seller', role: 'SELLER' },
  { email: process.env.E2E_ADMIN_EMAIL ?? 'e2e.admin@tradenest.invalid', name: 'E2E Admin', role: 'ADMIN' },
] as const;

const db = new Client({ connectionString });
await db.connect();
try {
  // This script refuses non-test database names above. Reset the dedicated E2E
  // database so browser journeys are deterministic across repeated local/CI runs.
  await db.query('TRUNCATE TABLE users, categories RESTART IDENTITY CASCADE');

  await db.query(
    `INSERT INTO categories (id,parent_id,name,slug)
     VALUES ($1,NULL,'E2E Category','e2e-category')`,
    ['00000000-0000-4000-8000-000000000040'],
  );

  const passwordHash = await hash(password, 10);
  const ids = new Map<string, string>();
  for (const fixture of fixtures) {
    const result = await db.query<{ id: string }>(
      `INSERT INTO users (id,email,password_hash,name,role,status)
       VALUES ($1::uuid,$2,$3,$4,$5::user_role,'ACTIVE')
       ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash,name=EXCLUDED.name,role=EXCLUDED.role,status='ACTIVE',updated_at=now()
       RETURNING id`,
      [randomUUID(), fixture.email.toLowerCase(), passwordHash, fixture.name, fixture.role],
    );
    ids.set(fixture.role, result.rows[0]!.id);
  }

  const fixtureIds = [...ids.values()];
  await db.query(`DELETE FROM user_sessions WHERE user_id = ANY($1::uuid[])`, [fixtureIds]);

  const sellerId = ids.get('SELLER')!;
  await db.query(
    `INSERT INTO seller_profiles (user_id,store_name,slug,status)
     VALUES ($1,'TradeNest E2E Store','tradenest-e2e-store','ACTIVE')
     ON CONFLICT (user_id) DO UPDATE SET store_name=EXCLUDED.store_name,slug=EXCLUDED.slug,status='ACTIVE',updated_at=now()`,
    [sellerId],
  );

  console.log(`TradeNest deterministic E2E fixtures seeded in ${databaseName}.`);
} finally {
  await db.end();
}
