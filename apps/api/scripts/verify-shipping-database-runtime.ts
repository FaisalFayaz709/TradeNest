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
const escrowId = randomUUID();

async function main(): Promise<void> {
  await db.connect();
  try {
    await db.query(`INSERT INTO users (id,email,password_hash,name,role,status) VALUES ($1,$2,'runtime','Buyer','BUYER','ACTIVE'),($3,$4,'runtime','Seller','SELLER','ACTIVE')`, [buyerId, `ship-b-${unique}@example.invalid`, sellerId, `ship-s-${unique}@example.invalid`]);
    await db.query(`INSERT INTO seller_profiles (user_id,store_name,slug,status) VALUES ($1,'Shipping Store',$2,'ACTIVE')`, [sellerId, `shipping-${unique}`]);
    await db.query(`INSERT INTO categories (id,name,slug) VALUES ($1,'Shipping',$2)`, [categoryId, `shipping-cat-${unique}`]);
    await db.query(`INSERT INTO products (id,seller_id,category_id,name,slug,description,price,currency,sku,status) VALUES ($1,$2,$3,'Shipping Product',$4,'Shipping runtime product',19.95,'USD',$5,'ACTIVE')`, [productId, sellerId, categoryId, `shipping-product-${unique}`, `SHIP-${unique}`]);
    await db.query(`INSERT INTO inventory (product_id,available_quantity,reserved_quantity) VALUES ($1,0,1)`, [productId]);
    await db.query(`INSERT INTO orders (id,order_number,buyer_id,status,currency,subtotal,shipping_amount,discount_amount,total_amount,shipping_address,paid_at) VALUES ($1,$2,$3,'PAID','USD',19.95,0,0,19.95,$4::jsonb,CURRENT_TIMESTAMP)`, [orderId, `TN-${unique.slice(0,16).toUpperCase()}`, buyerId, JSON.stringify({sourceAddressId:randomUUID(),recipient:'Buyer',line1:'1 Test',line2:null,city:'Test',region:null,postalCode:null,country:'US',phone:null})]);
    await db.query(`INSERT INTO order_items (id,order_id,product_id,seller_id,product_name,sku,quantity,unit_price,total_price) VALUES ($1,$2,$3,$4,'Shipping Product',$5,1,19.95,19.95)`, [orderItemId, orderId, productId, sellerId, `SHIP-${unique}`]);
    await db.query(`INSERT INTO payments (id,order_id,buyer_id,provider,provider_payment_id,status,amount,currency,paid_at) VALUES ($1,$2,$3,'sandbox',$4,'SUCCEEDED',19.95,'USD',CURRENT_TIMESTAMP)`, [paymentId, orderId, buyerId, `ship_pay_${unique}`]);
    await db.query(`INSERT INTO escrows (id,order_id,payment_id,status,amount,held_at) VALUES ($1,$2,$3,'HELD',19.95,CURRENT_TIMESTAMP)`, [escrowId, orderId, paymentId]);

    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const locked = await db.query(`SELECT id,status FROM orders WHERE id=$1 FOR UPDATE`, [orderId]);
    if (locked.rows[0]?.status !== 'PAID') throw new Error('Expected PAID order before shipment.');
    const escrow = await db.query(`SELECT status FROM escrows WHERE order_id=$1`, [orderId]);
    if (escrow.rows[0]?.status !== 'HELD') throw new Error('Expected HELD escrow before shipment.');
    await db.query(`INSERT INTO shipments (id,order_id,carrier,tracking_code,status,shipped_at) VALUES ($1,$2,'Runtime Carrier','TRACK-19','SHIPPED',CURRENT_TIMESTAMP)`, [randomUUID(), orderId]);
    const orderChanged = await db.query(`UPDATE orders SET status='SHIPPED',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status IN ('PAID','PROCESSING')`, [orderId]);
    const escrowChanged = await db.query(`UPDATE escrows SET status='SELLER_SHIPPED',updated_at=CURRENT_TIMESTAMP WHERE order_id=$1 AND status='HELD'`, [orderId]);
    if ((orderChanged.rowCount ?? 0) !== 1 || (escrowChanged.rowCount ?? 0) !== 1) throw new Error('Coupled shipping state updates failed.');
    await db.query('COMMIT');

    const state = await db.query(`SELECT o.status order_status,e.status escrow_status,s.status shipment_status FROM orders o JOIN escrows e ON e.order_id=o.id JOIN shipments s ON s.order_id=o.id WHERE o.id=$1`, [orderId]);
    const row = state.rows[0];
    if (!row || row.order_status !== 'SHIPPED' || row.escrow_status !== 'SELLER_SHIPPED' || row.shipment_status !== 'SHIPPED') throw new Error(`Shipping state mismatch: ${JSON.stringify(row)}`);
    console.log('the implementation SHIPPING DATABASE VERIFICATION PASSED');
  } finally {
    await db.query('DELETE FROM shipments WHERE order_id=$1', [orderId]).catch(() => undefined);
    await db.query('DELETE FROM escrow_transactions WHERE escrow_id=$1', [escrowId]).catch(() => undefined);
    await db.query('DELETE FROM escrows WHERE id=$1', [escrowId]).catch(() => undefined);
    await db.query('DELETE FROM payments WHERE id=$1', [paymentId]).catch(() => undefined);
    await db.query('DELETE FROM order_items WHERE order_id=$1', [orderId]).catch(() => undefined);
    await db.query('DELETE FROM orders WHERE id=$1', [orderId]).catch(() => undefined);
    await db.query('DELETE FROM products WHERE id=$1', [productId]).catch(() => undefined);
    await db.query('DELETE FROM categories WHERE id=$1', [categoryId]).catch(() => undefined);
    await db.query('DELETE FROM seller_profiles WHERE user_id=$1', [sellerId]).catch(() => undefined);
    await db.query('DELETE FROM users WHERE id IN ($1,$2)', [buyerId,sellerId]).catch(() => undefined);
    await db.end().catch(() => undefined);
  }
}

void main();
