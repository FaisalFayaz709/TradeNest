import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required.');
const db = new Client({ connectionString });

async function main(): Promise<void> {
  await db.connect();
  const suffix = randomUUID().replaceAll('-', '');
  const buyerId = randomUUID();
  const sellerId = randomUUID();
  const adminId = randomUUID();
  const categoryId = randomUUID();
  const productId = randomUUID();
  const orderId = randomUUID();
  const orderItemId = randomUUID();
  const paymentId = randomUUID();
  const escrowId = randomUUID();
  const disputeId = randomUUID();
  try {
    await db.query(`INSERT INTO users (id,email,password_hash,name,role,status) VALUES ($1,$2,'hash','Buyer','BUYER','ACTIVE'),($3,$4,'hash','Seller','SELLER','ACTIVE'),($5,$6,'hash','Admin','ADMIN','ACTIVE')`, [buyerId, `buyer-${suffix}@example.invalid`, sellerId, `seller-${suffix}@example.invalid`, adminId, `admin-${suffix}@example.invalid`]);
    await db.query(`INSERT INTO seller_profiles (user_id,store_name,slug,status) VALUES ($1,'dispute Store',$2,'ACTIVE')`, [sellerId, `dispute-${suffix}`]);
    await db.query(`INSERT INTO categories (id,name,slug) VALUES ($1,'dispute Category',$2)`, [categoryId, `dispute-cat-${suffix}`]);
    await db.query(`INSERT INTO products (id,seller_id,category_id,name,slug,description,sku,price,currency,status) VALUES ($1,$2,$3,'dispute Product',$4,'Runtime dispute product description',$5,19.95,'USD','ACTIVE')`, [productId, sellerId, categoryId, `dispute-product-${suffix}`, `dispute-${suffix}`]);
    await db.query(`INSERT INTO inventory (product_id,available_quantity,reserved_quantity) VALUES ($1,0,0)`, [productId]);
    await db.query(`INSERT INTO orders (id,order_number,buyer_id,status,currency,subtotal,shipping_amount,discount_amount,total_amount,shipping_address,paid_at) VALUES ($1,$2,$3,'SHIPPED','USD',19.95,0,0,19.95,$4::jsonb,CURRENT_TIMESTAMP)`, [orderId, `TN-D-${suffix.slice(0,14).toUpperCase()}`, buyerId, JSON.stringify({sourceAddressId:randomUUID(),recipient:'Buyer',line1:'1 Test',line2:null,city:'Test',region:null,postalCode:null,country:'US',phone:null})]);
    await db.query(`INSERT INTO order_items (id,order_id,product_id,seller_id,product_name,sku,quantity,unit_price,total_price) VALUES ($1,$2,$3,$4,'dispute Product',$5,1,19.95,19.95)`, [orderItemId, orderId, productId, sellerId, `dispute-${suffix}`]);
    await db.query(`INSERT INTO payments (id,order_id,buyer_id,provider,provider_payment_id,status,amount,currency,paid_at) VALUES ($1,$2,$3,'sandbox',$4,'SUCCEEDED',19.95,'USD',CURRENT_TIMESTAMP)`, [paymentId, orderId, buyerId, `dispute-pay-${suffix}`]);
    await db.query(`INSERT INTO escrows (id,order_id,payment_id,status,amount,held_at) VALUES ($1,$2,$3,'SELLER_SHIPPED',19.95,CURRENT_TIMESTAMP)`, [escrowId, orderId, paymentId]);
    await db.query(`INSERT INTO escrow_transactions (id,escrow_id,type,amount,reference) VALUES ($1,$2,'HOLD',19.95,'dispute-hold')`, [randomUUID(), escrowId]);

    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const lock = await db.query(`SELECT id,status,buyer_id FROM orders WHERE id=$1 FOR UPDATE`, [orderId]);
    if (lock.rows[0]?.status !== 'SHIPPED' || lock.rows[0]?.buyer_id !== buyerId) throw new Error('Expected owned SHIPPED order.');
    const escrow = await db.query(`SELECT id,status FROM escrows WHERE order_id=$1 FOR UPDATE`, [orderId]);
    if (escrow.rows[0]?.status !== 'SELLER_SHIPPED') throw new Error('Expected SELLER_SHIPPED escrow.');
    await db.query(`INSERT INTO disputes (id,order_id,buyer_id,seller_id,reason,description,status) VALUES ($1,$2,$3,$4,'Runtime issue','the implementation runtime dispute','OPEN')`, [disputeId, orderId, buyerId, sellerId]);
    const orderDisputed = await db.query(`UPDATE orders SET status='DISPUTED',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status IN ('PAID','PROCESSING','SHIPPED')`, [orderId]);
    const escrowDisputed = await db.query(`UPDATE escrows SET status='DISPUTED',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status IN ('HELD','SELLER_SHIPPED')`, [escrowId]);
    if ((orderDisputed.rowCount ?? 0) !== 1 || (escrowDisputed.rowCount ?? 0) !== 1) throw new Error('Dispute opening coupled transition failed.');
    await db.query(`INSERT INTO dispute_messages (id,dispute_id,author_id,body) VALUES ($1,$2,$3,'Seller response')`, [randomUUID(), disputeId, sellerId]);
    await db.query(`INSERT INTO dispute_evidence (id,dispute_id,uploaded_by_id,object_key,url,file_name,mime_type) VALUES ($1,$2,$3,'dispute/evidence.jpg','https://storage.example.invalid/dispute/evidence.jpg','evidence.jpg','image/jpeg')`, [randomUUID(), disputeId, buyerId]);
    await db.query('COMMIT');

    const open = await db.query(`SELECT d.status,o.status AS order_status,e.status AS escrow_status FROM disputes d JOIN orders o ON o.id=d.order_id JOIN escrows e ON e.order_id=o.id WHERE d.id=$1`, [disputeId]);
    if (open.rows[0]?.status !== 'OPEN' || open.rows[0]?.order_status !== 'DISPUTED' || open.rows[0]?.escrow_status !== 'DISPUTED') throw new Error('Dispute open state mismatch.');

    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    await db.query(`SELECT id FROM disputes WHERE id=$1 FOR UPDATE`, [disputeId]);
    const review = await db.query(`UPDATE escrows SET status='UNDER_REVIEW',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='DISPUTED'`, [escrowId]);
    if ((review.rowCount ?? 0) !== 1) throw new Error('Escrow did not enter UNDER_REVIEW.');
    const release = await db.query(`UPDATE escrows SET status='RELEASED',released_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='UNDER_REVIEW' RETURNING amount`, [escrowId]);
    if ((release.rowCount ?? 0) !== 1) throw new Error('Escrow dispute release failed.');
    await db.query(`INSERT INTO escrow_transactions (id,escrow_id,type,amount,reference) VALUES ($1,$2,'RELEASE',$3,'dispute-dispute-release')`, [randomUUID(), escrowId, release.rows[0].amount]);
    const completed = await db.query(`UPDATE orders SET status='COMPLETED',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='DISPUTED'`, [orderId]);
    if ((completed.rowCount ?? 0) !== 1) throw new Error('Disputed order did not complete on seller release.');
    const resolved = await db.query(`UPDATE disputes SET status='RESOLVED',resolution='RELEASE_TO_SELLER',resolved_by=$2,resolved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='OPEN'`, [disputeId, adminId]);
    if ((resolved.rowCount ?? 0) !== 1) throw new Error('Dispute resolution row failed.');
    await db.query(`INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,metadata) VALUES ($1,$2,'DISPUTE_RESOLUTION','dispute',$3,$4::jsonb)`, [randomUUID(), adminId, disputeId, JSON.stringify({orderId,outcome:'RELEASE_TO_SELLER'})]);
    await db.query('COMMIT');

    const final = await db.query(`SELECT d.status,d.resolution,o.status AS order_status,e.status AS escrow_status FROM disputes d JOIN orders o ON o.id=d.order_id JOIN escrows e ON e.order_id=o.id WHERE d.id=$1`, [disputeId]);
    const f = final.rows[0];
    if (!f || f.status !== 'RESOLVED' || f.resolution !== 'RELEASE_TO_SELLER' || f.order_status !== 'COMPLETED' || f.escrow_status !== 'RELEASED') {
      throw new Error(`Dispute resolution state mismatch: ${JSON.stringify(f)}`);
    }
    const ledger = await db.query(`SELECT COUNT(*)::int AS count FROM escrow_transactions WHERE escrow_id=$1 AND type='RELEASE'`, [escrowId]);
    if (ledger.rows[0]?.count !== 1) throw new Error('Expected one dispute RELEASE ledger entry.');
    const audit = await db.query(`SELECT COUNT(*)::int AS count FROM audit_logs WHERE entity_id=$1 AND action='DISPUTE_RESOLUTION'`, [disputeId]);
    if (audit.rows[0]?.count !== 1) throw new Error('Expected one dispute resolution audit entry.');
    console.log('the implementation DISPUTES DATABASE VERIFICATION PASSED');
  } finally {
    await db.query(`DELETE FROM audit_logs WHERE actor_id=$1`, [adminId]).catch(() => undefined);
    await db.query(`DELETE FROM dispute_evidence WHERE dispute_id=$1`, [disputeId]).catch(() => undefined);
    await db.query(`DELETE FROM dispute_messages WHERE dispute_id=$1`, [disputeId]).catch(() => undefined);
    await db.query(`DELETE FROM disputes WHERE id=$1`, [disputeId]).catch(() => undefined);
    await db.query(`DELETE FROM escrow_transactions WHERE escrow_id=$1`, [escrowId]).catch(() => undefined);
    await db.query(`DELETE FROM escrows WHERE id=$1`, [escrowId]).catch(() => undefined);
    await db.query(`DELETE FROM payments WHERE id=$1`, [paymentId]).catch(() => undefined);
    await db.query(`DELETE FROM order_items WHERE id=$1`, [orderItemId]).catch(() => undefined);
    await db.query(`DELETE FROM orders WHERE id=$1`, [orderId]).catch(() => undefined);
    await db.query(`DELETE FROM inventory WHERE product_id=$1`, [productId]).catch(() => undefined);
    await db.query(`DELETE FROM products WHERE id=$1`, [productId]).catch(() => undefined);
    await db.query(`DELETE FROM categories WHERE id=$1`, [categoryId]).catch(() => undefined);
    await db.query(`DELETE FROM seller_profiles WHERE user_id=$1`, [sellerId]).catch(() => undefined);
    await db.query(`DELETE FROM users WHERE id IN ($1,$2,$3)`, [buyerId,sellerId,adminId]).catch(() => undefined);
    await db.end().catch(() => undefined);
  }
}

void main();
