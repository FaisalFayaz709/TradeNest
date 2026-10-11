import 'dotenv/config';
import { randomUUID, createHash } from 'node:crypto';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required.');

const db = new Client({ connectionString });
const unique = randomUUID().replaceAll('-', '');
const buyerId = randomUUID();
const sellerId = randomUUID();
const categoryId = randomUUID();
const productId = randomUUID();
const addressId = randomUUID();
const cartId = randomUUID();
const cartItemId = randomUUID();
const orderId = randomUUID();
const orderItemId = randomUUID();
const paymentId = randomUUID();
const idempotencyId = randomUUID();
const keyHash = createHash('sha256').update(`checkout-runtime-${unique}`).digest('hex');

async function main(): Promise<void> {
  await db.connect();
  try {
    await db.query(
      `INSERT INTO users (id, email, password_hash, name, role, status)
       VALUES ($1,$2,'runtime-verifier-not-a-real-password-hash','Checkout Buyer','BUYER','ACTIVE'),
              ($3,$4,'runtime-verifier-not-a-real-password-hash','Checkout Seller','SELLER','ACTIVE')`,
      [buyerId, `checkout-buyer-${unique}@example.invalid`, sellerId, `checkout-seller-${unique}@example.invalid`],
    );
    await db.query(
      `INSERT INTO seller_profiles (user_id, store_name, slug, status)
       VALUES ($1,'Runtime Store',$2,'ACTIVE')`,
      [sellerId, `runtime-store-${unique}`],
    );
    await db.query(
      `INSERT INTO addresses (id,user_id,recipient,line1,city,country)
       VALUES ($1,$2,'Runtime Buyer','1 Runtime St','Runtime City','US')`,
      [addressId, buyerId],
    );
    await db.query('INSERT INTO categories (id,name,slug) VALUES ($1,$2,$3)', [categoryId, 'Runtime Checkout', `runtime-checkout-${unique}`]);
    await db.query(
      `INSERT INTO products
       (id,seller_id,category_id,name,slug,description,price,currency,sku,status)
       VALUES ($1,$2,$3,'Runtime Checkout Product',$4,
       'Runtime product used only for transactional checkout verification.',19.95,'USD',$5,'ACTIVE')`,
      [productId, sellerId, categoryId, `runtime-checkout-product-${unique}`, `runtime-checkout-sku-${unique}`],
    );
    await db.query('INSERT INTO inventory (product_id,available_quantity,reserved_quantity) VALUES ($1,2,0)', [productId]);
    await db.query('INSERT INTO carts (id,user_id,is_active) VALUES ($1,$2,true)', [cartId, buyerId]);
    await db.query('INSERT INTO cart_items (id,cart_id,product_id,quantity) VALUES ($1,$2,$3,1)', [cartItemId, cartId, productId]);

    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    try {
      const reserved = await db.query(
        `UPDATE inventory
         SET available_quantity=available_quantity-1,
             reserved_quantity=reserved_quantity+1,
             updated_at=CURRENT_TIMESTAMP
         WHERE product_id=$1 AND available_quantity>=1`,
        [productId],
      );
      if ((reserved.rowCount ?? 0) !== 1) throw new Error('Expected inventory reservation to succeed.');

      await db.query(
        `INSERT INTO orders
         (id,order_number,buyer_id,status,currency,subtotal,shipping_amount,discount_amount,total_amount,shipping_address)
         VALUES ($1,$2,$3,'PENDING_PAYMENT','USD',19.95,0,0,19.95,$4::jsonb)`,
        [orderId, `TN-${unique.slice(0, 16).toUpperCase()}`, buyerId, JSON.stringify({ sourceAddressId: addressId, recipient: 'Runtime Buyer', line1: '1 Runtime St', city: 'Runtime City', country: 'US' })],
      );
      await db.query(
        `INSERT INTO order_items
         (id,order_id,product_id,seller_id,product_name,sku,quantity,unit_price,total_price)
         VALUES ($1,$2,$3,$4,'Runtime Checkout Product',$5,1,19.95,19.95)`,
        [orderItemId, orderId, productId, sellerId, `runtime-checkout-sku-${unique}`],
      );
      await db.query(
        `INSERT INTO payments
         (id,order_id,buyer_id,provider,provider_payment_id,status,amount,currency)
         VALUES ($1,$2,$3,'INTERNAL_PENDING',$4,'PENDING',19.95,'USD')`,
        [paymentId, orderId, buyerId, `internal_pending_${paymentId}`],
      );
      await db.query('UPDATE carts SET is_active=false, updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND user_id=$2 AND is_active=true', [cartId, buyerId]);
      await db.query(
        `INSERT INTO idempotency_records
         (id,user_id,operation,key_hash,response,updated_at)
         VALUES ($1,$2,'CHECKOUT_CREATE',$3,$4::jsonb,CURRENT_TIMESTAMP)`,
        [idempotencyId, buyerId, keyHash, JSON.stringify({ orderId, paymentId })],
      );
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

    const state = await db.query<{
      available_quantity: number;
      reserved_quantity: number;
      order_status: string;
      payment_status: string;
      is_active: boolean;
    }>(
      `SELECT i.available_quantity,i.reserved_quantity,o.status AS order_status,
              p.status AS payment_status,c.is_active
       FROM inventory i
       JOIN orders o ON o.id=$2
       JOIN payments p ON p.order_id=o.id
       JOIN carts c ON c.id=$3
       WHERE i.product_id=$1`,
      [productId, orderId, cartId],
    );
    const row = state.rows[0];
    if (!row || row.available_quantity !== 1 || row.reserved_quantity !== 1 || row.order_status !== 'PENDING_PAYMENT' || row.payment_status !== 'PENDING' || row.is_active !== false) {
      throw new Error(`Committed checkout state is incorrect: ${JSON.stringify(row)}`);
    }

    let duplicateRejected = false;
    try {
      await db.query(
        `INSERT INTO idempotency_records (id,user_id,operation,key_hash,response,updated_at)
         VALUES ($1,$2,'CHECKOUT_CREATE',$3,'{}'::jsonb,CURRENT_TIMESTAMP)`,
        [randomUUID(), buyerId, keyHash],
      );
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : undefined;
      duplicateRejected = code === '23505';
      if (!duplicateRejected) throw error;
    }
    if (!duplicateRejected) throw new Error('Duplicate checkout Idempotency-Key was not rejected.');

    const beforeRollback = await db.query<{ available_quantity: number; reserved_quantity: number }>(
      'SELECT available_quantity,reserved_quantity FROM inventory WHERE product_id=$1', [productId],
    );
    await db.query('BEGIN');
    await db.query(
      `UPDATE inventory SET available_quantity=available_quantity-1,reserved_quantity=reserved_quantity+1,updated_at=CURRENT_TIMESTAMP
       WHERE product_id=$1 AND available_quantity>=1`,
      [productId],
    );
    await db.query('ROLLBACK');
    const afterRollback = await db.query<{ available_quantity: number; reserved_quantity: number }>(
      'SELECT available_quantity,reserved_quantity FROM inventory WHERE product_id=$1', [productId],
    );
    if (JSON.stringify(beforeRollback.rows[0]) !== JSON.stringify(afterRollback.rows[0])) {
      throw new Error('Rollback failed to restore inventory reservation state.');
    }

    console.log('TRANSACTIONAL CHECKOUT DATABASE RUNTIME VERIFICATION PASSED');
  } finally {
    await db.query('DELETE FROM idempotency_records WHERE user_id=$1', [buyerId]).catch(() => undefined);
    await db.query('DELETE FROM payments WHERE order_id=$1', [orderId]).catch(() => undefined);
    await db.query('DELETE FROM order_items WHERE order_id=$1', [orderId]).catch(() => undefined);
    await db.query('DELETE FROM orders WHERE id=$1', [orderId]).catch(() => undefined);
    await db.query('DELETE FROM users WHERE id=$1', [buyerId]).catch(() => undefined);
    await db.query('DELETE FROM products WHERE id=$1', [productId]).catch(() => undefined);
    await db.query('DELETE FROM categories WHERE id=$1', [categoryId]).catch(() => undefined);
    await db.query('DELETE FROM seller_profiles WHERE user_id=$1', [sellerId]).catch(() => undefined);
    await db.query('DELETE FROM users WHERE id=$1', [sellerId]).catch(() => undefined);
    await db.end().catch(() => undefined);
  }
}

void main();
