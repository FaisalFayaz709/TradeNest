import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required.');

const db = new Client({ connectionString });
const buyerId = randomUUID();
const orderId = randomUUID();
const paymentId = randomUUID();
const rollbackOrderId = randomUUID();
const rollbackPaymentId = randomUUID();
const unique = randomUUID().replaceAll('-', '');

async function seedOrder(order: string, payment: string, orderNumber: string): Promise<void> {
  await db.query(
    `INSERT INTO orders
      (id,order_number,buyer_id,status,currency,subtotal,shipping_amount,discount_amount,total_amount,shipping_address)
     VALUES ($1,$2,$3,'PENDING_PAYMENT','USD',19.95,0,0,19.95,'{}'::jsonb)`,
    [order, orderNumber, buyerId],
  );
  await db.query(
    `INSERT INTO payments
      (id,order_id,buyer_id,provider,provider_payment_id,status,amount,currency)
     VALUES ($1,$2,$3,'sandbox',$4,'PENDING',19.95,'USD')`,
    [payment, order, buyerId, `sandbox_${payment}`],
  );
}

async function main(): Promise<void> {
  await db.connect();
  try {
    await db.query(
      `INSERT INTO users (id,email,password_hash,name,role,status)
       VALUES ($1,$2,'runtime-verifier-not-a-real-password-hash','Payment Buyer','BUYER','ACTIVE')`,
      [buyerId, `payment-buyer-${unique}@example.invalid`],
    );
    await seedOrder(orderId, paymentId, `TN-PAY-${unique.slice(0, 12).toUpperCase()}`);

    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    try {
      const payment = await db.query(
        `UPDATE payments SET status='SUCCEEDED',paid_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 AND status='PENDING'`,
        [paymentId],
      );
      if ((payment.rowCount ?? 0) !== 1) throw new Error('Expected pending payment to transition to SUCCEEDED.');
      const order = await db.query(
        `UPDATE orders SET status='PAID',paid_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 AND status='PENDING_PAYMENT'`,
        [orderId],
      );
      if ((order.rowCount ?? 0) !== 1) throw new Error('Expected order to transition to PAID.');
      const escrow = await db.query<{ id: string }>(
        `INSERT INTO escrows (order_id,payment_id,status,amount,held_at)
         VALUES ($1,$2,'HELD',19.95,CURRENT_TIMESTAMP) RETURNING id`,
        [orderId, paymentId],
      );
      await db.query(
        `INSERT INTO escrow_transactions (escrow_id,type,amount,reference)
         VALUES ($1,'HOLD',19.95,$2)`,
        [escrow.rows[0]!.id, `sandbox-runtime:${paymentId}`],
      );
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

    const state = await db.query<{
      payment_status: string;
      order_status: string;
      escrow_status: string;
      ledger_count: string;
    }>(
      `SELECT p.status payment_status,o.status order_status,e.status escrow_status,
              (SELECT COUNT(*)::text FROM escrow_transactions et WHERE et.escrow_id=e.id AND et.type='HOLD') ledger_count
       FROM payments p JOIN orders o ON o.id=p.order_id JOIN escrows e ON e.payment_id=p.id
       WHERE p.id=$1`,
      [paymentId],
    );
    const row = state.rows[0];
    if (!row || row.payment_status !== 'SUCCEEDED' || row.order_status !== 'PAID' || row.escrow_status !== 'HELD' || row.ledger_count !== '1') {
      throw new Error(`Verified payment-success database state is incorrect: ${JSON.stringify(row)}`);
    }

    await seedOrder(rollbackOrderId, rollbackPaymentId, `TN-RBK-${unique.slice(0, 12).toUpperCase()}`);
    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    try {
      await db.query(`UPDATE payments SET status='SUCCEEDED',paid_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='PENDING'`, [rollbackPaymentId]);
      await db.query(`UPDATE orders SET status='PAID',paid_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='PENDING_PAYMENT'`, [rollbackOrderId]);
      await db.query(
        `INSERT INTO escrows (order_id,payment_id,status,amount,held_at)
         VALUES ($1,$2,'HELD',19.95,CURRENT_TIMESTAMP)`,
        [rollbackOrderId, randomUUID()],
      );
      throw new Error('Expected invalid payment FK to fail.');
    } catch {
      await db.query('ROLLBACK');
    }

    const rollbackState = await db.query<{ payment_status: string; order_status: string; escrow_count: string }>(
      `SELECT p.status payment_status,o.status order_status,
              (SELECT COUNT(*)::text FROM escrows e WHERE e.order_id=o.id) escrow_count
       FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id=$1`,
      [rollbackPaymentId],
    );
    const rolled = rollbackState.rows[0];
    if (!rolled || rolled.payment_status !== 'PENDING' || rolled.order_status !== 'PENDING_PAYMENT' || rolled.escrow_count !== '0') {
      throw new Error(`Financial rollback did not restore all state: ${JSON.stringify(rolled)}`);
    }

    console.log('the implementation PAYMENT DATABASE TRANSACTION VERIFICATION PASSED');
  } finally {
    await db.query('DELETE FROM escrow_transactions WHERE escrow_id IN (SELECT id FROM escrows WHERE order_id = ANY($1::uuid[]))', [[orderId, rollbackOrderId]]).catch(() => undefined);
    await db.query('DELETE FROM escrows WHERE order_id = ANY($1::uuid[])', [[orderId, rollbackOrderId]]).catch(() => undefined);
    await db.query('DELETE FROM payments WHERE order_id = ANY($1::uuid[])', [[orderId, rollbackOrderId]]).catch(() => undefined);
    await db.query('DELETE FROM orders WHERE id = ANY($1::uuid[])', [[orderId, rollbackOrderId]]).catch(() => undefined);
    await db.query('DELETE FROM users WHERE id=$1', [buyerId]).catch(() => undefined);
    await db.end().catch(() => undefined);
  }
}

void main();
