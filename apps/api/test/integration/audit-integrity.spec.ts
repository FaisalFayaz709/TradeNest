import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const connectionString = process.env.TEST_DATABASE_URL;
const runDatabaseSuite = connectionString ? describe : describe.skip;

function assertTestDatabase(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, '').toLowerCase();
  if (!name.includes('e2e') && !name.includes('test')) {
    throw new Error(`Refusing integration tests against non-test database: ${name}`);
  }
}

runDatabaseSuite('audit log database integrity', () => {
  let db: Client;
  const committedId = randomUUID();
  const rolledBackId = randomUUID();

  beforeAll(async () => {
    assertTestDatabase(connectionString!);
    db = new Client({ connectionString });
    await db.connect();
  });

  afterAll(async () => {
    if (!db) return;
    await db.query(`DELETE FROM audit_logs WHERE id IN ($1,$2)`, [committedId, rolledBackId]).catch(() => undefined);
    await db.end().catch(() => undefined);
  });

  it('persists a structured audit row with a request correlation id', async () => {
    await db.query(
      `INSERT INTO audit_logs (id,action,entity_type,before,after,metadata,request_id)
       VALUES ($1,'ESCROW_RELEASE','escrow',$2::jsonb,$3::jsonb,$4::jsonb,$5)`,
      [committedId, JSON.stringify({ status: 'BUYER_CONFIRMED' }), JSON.stringify({ status: 'RELEASED' }), JSON.stringify({ cause: 'TEST' }), 'audit-audit-request'],
    );
    const row = await db.query(`SELECT action,entity_type,before,after,metadata,request_id FROM audit_logs WHERE id=$1`, [committedId]);
    expect(row.rows[0]).toMatchObject({
      action: 'ESCROW_RELEASE',
      entity_type: 'escrow',
      request_id: 'audit-audit-request',
    });
    expect(row.rows[0].before).toEqual({ status: 'BUYER_CONFIRMED' });
    expect(row.rows[0].after).toEqual({ status: 'RELEASED' });
  });

  it('rolls audit work back with the surrounding business transaction', async () => {
    await db.query('BEGIN');
    await db.query(
      `INSERT INTO audit_logs (id,action,entity_type,request_id) VALUES ($1,'ESCROW_REFUND','escrow','audit-rollback')`,
      [rolledBackId],
    );
    await db.query('ROLLBACK');
    const row = await db.query(`SELECT id FROM audit_logs WHERE id=$1`, [rolledBackId]);
    expect(row.rowCount).toBe(0);
  });

  it('enforces the locked VARCHAR(128) request-id storage boundary', async () => {
    await expect(db.query(
      `INSERT INTO audit_logs (id,action,entity_type,request_id) VALUES ($1,'ESCROW_RELEASE','escrow',$2)`,
      [randomUUID(), 'x'.repeat(129)],
    )).rejects.toMatchObject({ code: '22001' });
  });
});
