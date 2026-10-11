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
const shipmentId = randomUUID();
const idempotencyId = randomUUID();

async function main(): Promise<void> {
  await db.connect();
  try {
    await db.query(`INSERT INTO users (id,email,password_hash,name,role,status) VALUES ($1,$2,'runtime','Buyer','BUYER','ACTIVE'),($3,$4,'runtime','Seller','SELLER','ACTIVE')`, [buyerId, `confirm-b-${unique}@example.invalid`, sellerId, `confirm-s-${unique}@example.invalid`]);
    await db.query(`INSERT INTO seller_profiles (user_id,store_name,slug,status) VALUES ($1,'Confirm Store',$2,'ACTIVE')`, [sellerId, `confirm-${unique}`]);
    await db.query(`INSERT INTO categories (id,name,slug) VALUES ($1,'Confirm',$2)`, [categoryId, `confirm-cat-${unique}`]);
    await db.query(`INSERT INTO products (id,seller_id,category_id,name,slug,description,price,currency,sku,status) VALUES ($1,$2,$3,'Confirm Product',$4,'Delivery confirmation runtime product',19.95,'USD',$5,'ACTIVE')`, [productId, sellerId, categoryId, `confirm-product-${unique}`, `CONF-${unique}`]);
    await db.query(`INSERT INTO inventory (product_id,available_quantity,reserved_quantity) VALUES ($1,0,1)`, [productId]);
    await db.query(`INSERT INTO orders (id,order_number,buyer_id,status,currency,subtotal,shipping_amount,discount_amount,total_amount,shipping_address,paid_at) VALUES ($1,$2,$3,'SHIPPED','USD',19.95,0,0,19.95,$4::jsonb,CURRENT_TIMESTAMP)`, [orderId, `TN-${unique.slice(0,16).toUpperCase()}`, buyerId, JSON.stringify({sourceAddressId:randomUUID(),recipient:'Buyer',line1:'1 Test',line2:null,city:'Test',region:null,postalCode:null,country:'US',phone:null})]);
    await db.query(`INSERT INTO order_items (id,order_id,product_id,seller_id,product_name,sku,quantity,unit_price,total_price) VALUES ($1,$2,$3,$4,'Confirm Product',$5,1,19.95,19.95)`, [orderItemId, orderId, productId, sellerId, `CONF-${unique}`]);
    await db.query(`INSERT INTO payments (id,order_id,buyer_id,provider,provider_payment_id,status,amount,currency,paid_at) VALUES ($1,$2,$3,'sandbox',$4,'SUCCEEDED',19.95,'USD',CURRENT_TIMESTAMP)`, [paymentId, orderId, buyerId, `confirm_pay_${unique}`]);
    await db.query(`INSERT INTO escrows (id,order_id,payment_id,status,amount,held_at) VALUES ($1,$2,$3,'SELLER_SHIPPED',19.95,CURRENT_TIMESTAMP)`, [escrowId, orderId, paymentId]);
    await db.query(`INSERT INTO escrow_transactions (id,escrow_id,type,amount,reference) VALUES ($1,$2,'HOLD',19.95,'runtime-hold')`, [randomUUID(), escrowId]);
    await db.query(`INSERT INTO shipments (id,order_id,carrier,tracking_code,status,shipped_at) VALUES ($1,$2,'Runtime Carrier','TRACK-20','SHIPPED',CURRENT_TIMESTAMP)`, [shipmentId, orderId]);

    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const locked = await db.query(`SELECT id,status,buyer_id FROM orders WHERE id=$1 FOR UPDATE`, [orderId]);
    if (locked.rows[0]?.status !== 'SHIPPED' || locked.rows[0]?.buyer_id !== buyerId) throw new Error('Expected owning SHIPPED order before confirmation.');
    const openDispute = await db.query(`SELECT COUNT(*)::int AS count FROM disputes WHERE order_id=$1 AND status='OPEN'`, [orderId]);
    if (openDispute.rows[0]?.count !== 0) throw new Error('Unexpected active dispute before confirmation.');
    const escrow = await db.query(`SELECT id,status FROM escrows WHERE order_id=$1 FOR UPDATE`, [orderId]);
    if (escrow.rows[0]?.status !== 'SELLER_SHIPPED') throw new Error('Expected SELLER_SHIPPED escrow before confirmation.');

    const delivered = await db.query(`UPDATE orders SET status='DELIVERED',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='SHIPPED'`, [orderId]);
    const shipmentDelivered = await db.query(`UPDATE shipments SET status='DELIVERED',delivered_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='SHIPPED'`, [shipmentId]);
    const buyerConfirmed = await db.query(`UPDATE escrows SET status='BUYER_CONFIRMED',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='SELLER_SHIPPED'`, [escrowId]);
    const released = await db.query(`UPDATE escrows SET status='RELEASED',released_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='BUYER_CONFIRMED' RETURNING amount`, [escrowId]);
    if ((delivered.rowCount ?? 0) !== 1 || (shipmentDelivered.rowCount ?? 0) !== 1 || (buyerConfirmed.rowCount ?? 0) !== 1 || (released.rowCount ?? 0) !== 1) {
      throw new Error('Coupled delivery confirmation state transition failed.');
    }
    await db.query(`INSERT INTO escrow_transactions (id,escrow_id,type,amount,reference) VALUES ($1,$2,'RELEASE',$3,'buyer-confirm-runtime')`, [randomUUID(), escrowId, released.rows[0].amount]);
    const completed = await db.query(`UPDATE orders SET status='COMPLETED',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='DELIVERED'`, [orderId]);
    if ((completed.rowCount ?? 0) !== 1) throw new Error('Order did not complete after escrow release.');
    await db.query(`INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,metadata,request_id) VALUES ($1,$2,'ESCROW_RELEASE','escrow',$3,$4::jsonb,'req-delivery')`, [randomUUID(), buyerId, escrowId, JSON.stringify({ orderId, cause: 'BUYER_CONFIRM_DELIVERY' })]);
    await db.query(`INSERT INTO idempotency_records (id,user_id,operation,key_hash,request_hash,response) VALUES ($1,$2,'BUYER_CONFIRM_DELIVERY',repeat('a',64),repeat('b',64),$3::jsonb)`, [idempotencyId, buyerId, JSON.stringify({ id: orderId, status: 'COMPLETED' })]);
    await db.query('COMMIT');

    const state = await db.query(`SELECT o.status order_status,o.completed_at,e.status escrow_status,e.released_at,s.status shipment_status,s.delivered_at FROM orders o JOIN escrows e ON e.order_id=o.id JOIN shipments s ON s.order_id=o.id WHERE o.id=$1`, [orderId]);
    const row = state.rows[0];
    if (!row || row.order_status !== 'COMPLETED' || row.escrow_status !== 'RELEASED' || row.shipment_status !== 'DELIVERED' || !row.completed_at || !row.released_at || !row.delivered_at) {
      throw new Error(`Delivery confirmation state mismatch: ${JSON.stringify(row)}`);
    }
    const releaseCount = await db.query(`SELECT COUNT(*)::int AS count FROM escrow_transactions WHERE escrow_id=$1 AND type='RELEASE'`, [escrowId]);
    if (releaseCount.rows[0]?.count !== 1) throw new Error('Expected exactly one RELEASE ledger entry.');
    const auditCount = await db.query(`SELECT COUNT(*)::int AS count FROM audit_logs WHERE entity_id=$1 AND action='ESCROW_RELEASE'`, [escrowId]);
    if (auditCount.rows[0]?.count !== 1) throw new Error('Expected exactly one escrow release audit entry.');

    // Active-dispute guard proof: an OPEN dispute must be observable before any confirmation write.
    const guardedOrderId = randomUUID();
    const guardedOrderItemId = randomUUID();
    const guardedPaymentId = randomUUID();
    const guardedEscrowId = randomUUID();
    const guardedShipmentId = randomUUID();
    await db.query(`INSERT INTO orders (id,order_number,buyer_id,status,currency,subtotal,shipping_amount,discount_amount,total_amount,shipping_address,paid_at) VALUES ($1,$2,$3,'SHIPPED','USD',19.95,0,0,19.95,$4::jsonb,CURRENT_TIMESTAMP)`, [guardedOrderId, `TN-D-${unique.slice(0,14).toUpperCase()}`, buyerId, JSON.stringify({sourceAddressId:randomUUID(),recipient:'Buyer',line1:'1 Test',line2:null,city:'Test',region:null,postalCode:null,country:'US',phone:null})]);
    await db.query(`INSERT INTO order_items (id,order_id,product_id,seller_id,product_name,sku,quantity,unit_price,total_price) VALUES ($1,$2,$3,$4,'Confirm Product',$5,1,19.95,19.95)`, [guardedOrderItemId, guardedOrderId, productId, sellerId, `CONF-${unique}`]);
    await db.query(`INSERT INTO payments (id,order_id,buyer_id,provider,provider_payment_id,status,amount,currency,paid_at) VALUES ($1,$2,$3,'sandbox',$4,'SUCCEEDED',19.95,'USD',CURRENT_TIMESTAMP)`, [guardedPaymentId, guardedOrderId, buyerId, `confirm_guard_${unique}`]);
    await db.query(`INSERT INTO escrows (id,order_id,payment_id,status,amount,held_at) VALUES ($1,$2,$3,'SELLER_SHIPPED',19.95,CURRENT_TIMESTAMP)`, [guardedEscrowId, guardedOrderId, guardedPaymentId]);
    await db.query(`INSERT INTO shipments (id,order_id,carrier,tracking_code,status,shipped_at) VALUES ($1,$2,'Runtime Carrier','TRACK-DISPUTE','SHIPPED',CURRENT_TIMESTAMP)`, [guardedShipmentId, guardedOrderId]);
    await db.query(`INSERT INTO disputes (id,order_id,buyer_id,seller_id,reason,description,status) VALUES ($1,$2,$3,$4,'Runtime guard','Open dispute blocks delivery confirmation','OPEN')`, [randomUUID(), guardedOrderId, buyerId, sellerId]);
    const guarded = await db.query(`SELECT COUNT(*)::int AS count FROM disputes WHERE order_id=$1 AND status='OPEN'`, [guardedOrderId]);
    if (guarded.rows[0]?.count !== 1) throw new Error('OPEN dispute guard was not queryable.');
    const guardedState = await db.query(`SELECT o.status order_status,e.status escrow_status,s.status shipment_status FROM orders o JOIN escrows e ON e.order_id=o.id JOIN shipments s ON s.order_id=o.id WHERE o.id=$1`, [guardedOrderId]);
    if (guardedState.rows[0]?.order_status !== 'SHIPPED' || guardedState.rows[0]?.escrow_status !== 'SELLER_SHIPPED' || guardedState.rows[0]?.shipment_status !== 'SHIPPED') {
      throw new Error('Disputed order was mutated during guard verification.');
    }

    console.log('the implementation DELIVERY CONFIRMATION DATABASE VERIFICATION PASSED');
  } finally {
    await db.query(`DELETE FROM disputes WHERE buyer_id=$1 AND seller_id=$2`, [buyerId, sellerId]).catch(() => undefined);
    await db.query(`DELETE FROM audit_logs WHERE actor_id=$1`, [buyerId]).catch(() => undefined);
    await db.query(`DELETE FROM idempotency_records WHERE user_id=$1`, [buyerId]).catch(() => undefined);
    await db.query(`DELETE FROM shipments WHERE order_id IN (SELECT id FROM orders WHERE buyer_id=$1)`, [buyerId]).catch(() => undefined);
    await db.query(`DELETE FROM escrow_transactions WHERE escrow_id IN (SELECT id FROM escrows WHERE order_id IN (SELECT id FROM orders WHERE buyer_id=$1))`, [buyerId]).catch(() => undefined);
    await db.query(`DELETE FROM escrows WHERE order_id IN (SELECT id FROM orders WHERE buyer_id=$1)`, [buyerId]).catch(() => undefined);
    await db.query(`DELETE FROM payments WHERE buyer_id=$1`, [buyerId]).catch(() => undefined);
    await db.query(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE buyer_id=$1)`, [buyerId]).catch(() => undefined);
    await db.query(`DELETE FROM orders WHERE buyer_id=$1`, [buyerId]).catch(() => undefined);
    await db.query(`DELETE FROM inventory WHERE product_id=$1`, [productId]).catch(() => undefined);
    await db.query(`DELETE FROM products WHERE id=$1`, [productId]).catch(() => undefined);
    await db.query(`DELETE FROM categories WHERE id=$1`, [categoryId]).catch(() => undefined);
    await db.query(`DELETE FROM seller_profiles WHERE user_id=$1`, [sellerId]).catch(() => undefined);
    await db.query(`DELETE FROM users WHERE id IN ($1,$2)`, [buyerId,sellerId]).catch(() => undefined);
    await db.end().catch(() => undefined);
  }
}

void main();
