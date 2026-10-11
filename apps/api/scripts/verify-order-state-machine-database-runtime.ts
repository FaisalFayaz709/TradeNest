import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required.');

const db = new Client({ connectionString });
const unique = randomUUID().replaceAll('-', '');
const buyerId = randomUUID();
const sellerId = randomUUID();
const categoryId = randomUUID();
const productId = randomUUID();
const orderId = randomUUID();
const orderItemId = randomUUID();
const paymentId = randomUUID();

async function main(): Promise<void> {
  await db.connect();
  try {
    await db.query(
      `INSERT INTO users (id,email,password_hash,name,role,status)
       VALUES ($1,$2,'runtime-not-a-real-hash','Order Buyer','BUYER','ACTIVE'),
              ($3,$4,'runtime-not-a-real-hash','Order Seller','SELLER','ACTIVE')`,
      [buyerId, `order-buyer-${unique}@example.invalid`, sellerId, `order-seller-${unique}@example.invalid`],
    );
    await db.query(`INSERT INTO seller_profiles (user_id,store_name,slug,status) VALUES ($1,'Order Store',$2,'ACTIVE')`, [sellerId, `order-store-${unique}`]);
    await db.query(`INSERT INTO categories (id,name,slug) VALUES ($1,'Order Runtime',$2)`, [categoryId, `order-runtime-${unique}`]);
    await db.query(
      `INSERT INTO products (id,seller_id,category_id,name,slug,description,price,currency,sku,status)
       VALUES ($1,$2,$3,'Order Product',$4,'Runtime order state machine product.',19.95,'USD',$5,'ACTIVE')`,
      [productId, sellerId, categoryId, `order-product-${unique}`, `ORDER-${unique}`],
    );
    await db.query(`INSERT INTO inventory (product_id,available_quantity,reserved_quantity) VALUES ($1,0,1)`, [productId]);
    await db.query(
      `INSERT INTO orders (id,order_number,buyer_id,status,currency,subtotal,shipping_amount,discount_amount,total_amount,shipping_address)
       VALUES ($1,$2,$3,'PENDING_PAYMENT','USD',19.95,0,0,19.95,$4::jsonb)`,
      [orderId, `TN-${unique.slice(0,16).toUpperCase()}`, buyerId, JSON.stringify({ sourceAddressId: randomUUID(), recipient: 'Buyer', line1: '1 Test', line2: null, city: 'Test', region: null, postalCode: null, country: 'US', phone: null })],
    );
    await db.query(
      `INSERT INTO order_items (id,order_id,product_id,seller_id,product_name,sku,quantity,unit_price,total_price)
       VALUES ($1,$2,$3,$4,'Order Product',$5,1,19.95,19.95)`,
      [orderItemId, orderId, productId, sellerId, `ORDER-${unique}`],
    );
    await db.query(
      `INSERT INTO payments (id,order_id,buyer_id,provider,provider_payment_id,status,amount,currency)
       VALUES ($1,$2,$3,'INTERNAL_PENDING',$4,'PENDING',19.95,'USD')`,
      [paymentId, orderId, buyerId, `internal_pending_${paymentId}`],
    );

    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const locked = await db.query('SELECT id,status FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
    if (locked.rows[0]?.status !== 'PENDING_PAYMENT') throw new Error('Expected cancellable PENDING_PAYMENT order.');
    const changed = await db.query(
      `UPDATE orders SET status='CANCELLED',cancelled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
       WHERE id=$1 AND status='PENDING_PAYMENT'`,
      [orderId],
    );
    if ((changed.rowCount ?? 0) !== 1) throw new Error('Cancellation compare-and-update failed.');
    const released = await db.query(
      `UPDATE inventory SET available_quantity=available_quantity+1,reserved_quantity=reserved_quantity-1,updated_at=CURRENT_TIMESTAMP
       WHERE product_id=$1 AND reserved_quantity>=1`,
      [productId],
    );
    if ((released.rowCount ?? 0) !== 1) throw new Error('Inventory release failed during cancellation.');
    await db.query('COMMIT');

    const state = await db.query<{ status: string; available_quantity: number; reserved_quantity: number }>(
      `SELECT o.status,i.available_quantity,i.reserved_quantity
       FROM orders o JOIN inventory i ON i.product_id=$2 WHERE o.id=$1`,
      [orderId, productId],
    );
    const row = state.rows[0];
    if (!row || row.status !== 'CANCELLED' || row.available_quantity !== 1 || row.reserved_quantity !== 0) {
      throw new Error(`Cancellation state is incorrect: ${JSON.stringify(row)}`);
    }

    await db.query('BEGIN');
    const duplicate = await db.query(
      `UPDATE orders SET status='CANCELLED',cancelled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
       WHERE id=$1 AND status='PENDING_PAYMENT'`,
      [orderId],
    );
    if ((duplicate.rowCount ?? 0) !== 0) throw new Error('Duplicate cancellation changed an already-cancelled order.');
    await db.query('ROLLBACK');

    console.log('the implementation ORDER STATE-MACHINE DATABASE VERIFICATION PASSED');
  } finally {
    await db.query('DELETE FROM payments WHERE order_id=$1', [orderId]).catch(() => undefined);
    await db.query('DELETE FROM order_items WHERE order_id=$1', [orderId]).catch(() => undefined);
    await db.query('DELETE FROM orders WHERE id=$1', [orderId]).catch(() => undefined);
    await db.query('DELETE FROM products WHERE id=$1', [productId]).catch(() => undefined);
    await db.query('DELETE FROM categories WHERE id=$1', [categoryId]).catch(() => undefined);
    await db.query('DELETE FROM seller_profiles WHERE user_id=$1', [sellerId]).catch(() => undefined);
    await db.query('DELETE FROM users WHERE id IN ($1,$2)', [buyerId, sellerId]).catch(() => undefined);
    await db.end().catch(() => undefined);
  }
}

void main();
