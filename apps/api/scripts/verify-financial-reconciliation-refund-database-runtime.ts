/** Live PostgreSQL 18 Financial reconciliation safety checks; test database ONLY.
 * Rollback-only FK/unique/constraint verification: no real provider calls.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Client} from 'pg';
const raw=process.env.TEST_DATABASE_URL;
if(!raw || raw!==process.env.DATABASE_URL) throw new Error('DATABASE_URL must equal TEST_DATABASE_URL');
const url=new URL(raw);
if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname) ||
  !/^tradenest(?:_[a-z0-9]+)*_test$/.test(url.pathname.substring(1))) {
  throw new Error('Financial reconciliation will only run against a disposable localhost *_test database');
}
const client=new Client({connectionString:raw,statement_timeout:10_000});
await client.connect();
try {
  const server=await client.query<{n:number}>(`SELECT current_setting('server_version_num')::int AS n`);
  assert.ok(server.rows[0]!.n>=180000 && server.rows[0]!.n<190000,'Requires PostgreSQL 18');
  const indexes=await client.query<{indexname:string}>(`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='refund_operations'`);
  const names=new Set(indexes.rows.map(x=>x.indexname));
  assert.ok(names.has('refund_operations_escrow_key'),'Missing UNIQUE escrow refund obligation');
  assert.ok(names.has('refund_operations_provider_refund_key'),'Missing provider-refund uniqueness');
  const constraints=await client.query<{conname:string}>(`SELECT conname FROM pg_constraint WHERE conrelid='refund_operations'::regclass`);
  for(const name of ['refund_operations_amount_positive_check','refund_operations_attempts_nonnegative_check','refund_operations_status_check',
    'refund_operations_escrow_fk','refund_operations_payment_fk','refund_operations_actor_fk'])
    assert.ok(constraints.rows.some(x=>x.conname===name),`Missing refund DB constraint ${name}`);
  // Pure invalid-write case, rolled back: no phantom obligation may survive.
  await client.query('BEGIN');
  try {
    await assert.rejects(()=>client.query(`INSERT INTO refund_operations
      (id,escrow_id,payment_id,actor_id,provider,amount,currency,status)
      VALUES ($1,$2,$3,$4,'sandbox',-1,'USD','READY')`,
      [randomUUID(),randomUUID(),randomUUID(),randomUUID()]));
  } finally { await client.query('ROLLBACK'); }
  console.log('FINANCIAL RECONCILIATION DATABASE VERIFICATION PASSED: PostgreSQL 18, unique keys, foreign keys, CHECKs, rollback.');
} finally { await client.end(); }
