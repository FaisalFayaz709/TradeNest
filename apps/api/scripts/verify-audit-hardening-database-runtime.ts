import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required.');
  const client = new Client({ connectionString });
  await client.connect();
  const id = randomUUID();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO audit_logs (id,action,entity_type,before,after,metadata,request_id)
       VALUES ($1,'ESCROW_RELEASE','escrow',$2::jsonb,$3::jsonb,$4::jsonb,$5)`,
      [id, JSON.stringify({ status: 'BUYER_CONFIRMED' }), JSON.stringify({ status: 'RELEASED' }), JSON.stringify({ verification: 'audit' }), 'audit-db-verification'],
    );
    const inside = await client.query(`SELECT request_id FROM audit_logs WHERE id=$1`, [id]);
    assert.equal(inside.rows[0]?.request_id, 'audit-db-verification');
    await client.query('ROLLBACK');
    const outside = await client.query(`SELECT id FROM audit_logs WHERE id=$1`, [id]);
    assert.equal(outside.rowCount, 0);
    console.log('the implementation audit hardening database verification passed.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

void main();
