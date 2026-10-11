import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { assertLocalTestDatabaseUrl } from './fulfillment-test-database-guard.js';

const url = process.env.DATABASE_URL;
assertLocalTestDatabaseUrl(url);
const db = new Client({ connectionString: url });
const buyer = randomUUID(), order = randomUUID();
const suffix = randomUUID().replaceAll('-', '');

async function rejected(statement: string, parameters: unknown[], constraint: string): Promise<void> {
  await db.query('SAVEPOINT fulfillment_negative');
  try {
    await db.query(statement, parameters);
    throw new Error(`Invalid statement was accepted (${constraint})`);
  } catch (error) {
    if (!String(error).includes(constraint)) throw error;
  } finally {
    await db.query('ROLLBACK TO SAVEPOINT fulfillment_negative');
    await db.query('RELEASE SAVEPOINT fulfillment_negative');
  }
}

await db.connect();
try {
  await db.query('BEGIN');
  await db.query(`INSERT INTO users (id,email,password_hash,name,role,status) VALUES ($1,$2,'test-only','Fulfillment Buyer','BUYER','ACTIVE')`, [buyer, `fulfillment-${suffix}@example.invalid`]);
  await db.query(`INSERT INTO orders (id,order_number,buyer_id,status,currency,subtotal,shipping_amount,discount_amount,total_amount,shipping_address)
    VALUES ($1,$2,$3,'SHIPPED','USD',12,0,0,12,'{}'::jsonb)`, [order, `TN8-${suffix.slice(0,16)}`, buyer]);
  await db.query(`INSERT INTO shipments (id,order_id,carrier,tracking_code,status,shipped_at)
    VALUES ($1,$2,'Test carrier','FULFILLMENT-T1','SHIPPED',CURRENT_TIMESTAMP)`, [randomUUID(), order]);
  await rejected(`INSERT INTO shipments (id,order_id,carrier,tracking_code,status,shipped_at)
    VALUES ($1,$2,'Test carrier','FULFILLMENT-T2','SHIPPED',CURRENT_TIMESTAMP)`, [randomUUID(), order], 'shipments_order_id_key');
  await rejected(`UPDATE shipments SET status='FAKE_STATUS' WHERE order_id=$1`, [order], 'shipments_valid_state_check');
  await rejected(`UPDATE shipments SET status='DELIVERED' WHERE order_id=$1`, [order], 'shipments_valid_state_check');
  await rejected(`UPDATE shipments SET tracking_code='  ' WHERE order_id=$1`, [order], 'shipments_valid_state_check');
  await db.query(`UPDATE shipments SET status='DELIVERED', delivered_at=CURRENT_TIMESTAMP WHERE order_id=$1`, [order]);
  const result = await db.query(`SELECT status,delivered_at FROM shipments WHERE order_id=$1`, [order]);
  if (result.rows[0]?.status !== 'DELIVERED' || !result.rows[0]?.delivered_at) throw new Error('Valid delivery transition failed.');
  console.log('FULFILLMENT PostgreSQL constraint tests PASSED (duplicate, invalid state, incomplete delivery, blank tracking, valid delivery).');
} finally {
  await db.query('ROLLBACK').catch(() => undefined);
  await db.end().catch(() => undefined);
}
