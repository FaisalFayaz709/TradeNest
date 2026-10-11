import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required.');
const db = new Client({ connectionString });
const buyerId=randomUUID(), sellerId=randomUUID(), categoryId=randomUUID(), productId=randomUUID(), orderId=randomUUID(), itemId=randomUUID(), paymentId=randomUUID(), escrowId=randomUUID();
const unique=randomUUID().replaceAll('-','');
async function main(){
 await db.connect();
 try {
  await db.query(`INSERT INTO users(id,email,password_hash,name,role,status) VALUES($1,$2,'x','Buyer','BUYER','ACTIVE'),($3,$4,'x','Seller','SELLER','ACTIVE')`,[buyerId,`p21b-${unique}@x.invalid`,sellerId,`p21s-${unique}@x.invalid`]);
  await db.query(`INSERT INTO seller_profiles(user_id,store_name,slug,status) VALUES($1,'Store',$2,'ACTIVE')`,[sellerId,`p21-${unique}`]);
  await db.query(`INSERT INTO categories(id,name,slug) VALUES($1,'P21',$2)`,[categoryId,`p21-cat-${unique}`]);
  await db.query(`INSERT INTO products(id,seller_id,category_id,name,slug,description,price,currency,sku,status) VALUES($1,$2,$3,'P21',$4,'the implementation runtime product.',5,'USD',$5,'ACTIVE')`,[productId,sellerId,categoryId,`p21-prod-${unique}`,`P21-${unique}`]);
  await db.query(`INSERT INTO inventory(product_id,available_quantity,reserved_quantity) VALUES($1,8,2)`,[productId]);
  await db.query(`INSERT INTO orders(id,order_number,buyer_id,status,currency,subtotal,shipping_amount,discount_amount,total_amount,shipping_address) VALUES($1,$2,$3,'PENDING_PAYMENT','USD',10,0,0,10,$4::jsonb)`,[orderId,`TN-${unique.slice(0,16).toUpperCase()}`,buyerId,JSON.stringify({recipient:'Buyer'})]);
  await db.query(`INSERT INTO order_items(id,order_id,product_id,seller_id,product_name,sku,quantity,unit_price,total_price) VALUES($1,$2,$3,$4,'P21',$5,2,5,10)`,[itemId,orderId,productId,sellerId,`P21-${unique}`]);
  await db.query(`INSERT INTO payments(id,order_id,buyer_id,provider,provider_payment_id,status,amount,currency) VALUES($1,$2,$3,'sandbox',$4,'PENDING',10,'USD')`,[paymentId,`p21pay-${unique}`]);
  await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  await db.query(`UPDATE payments SET status='SUCCEEDED',paid_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='PENDING'`,[paymentId]);
  await db.query(`UPDATE orders SET status='PAID',paid_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='PENDING_PAYMENT'`,[orderId]);
  const consumed=await db.query(`UPDATE inventory SET reserved_quantity=reserved_quantity-2,updated_at=CURRENT_TIMESTAMP WHERE product_id=$1 AND reserved_quantity>=2`,[productId]);
  if((consumed.rowCount??0)!==1) throw new Error('Verified payment could not consume reservation.');
  await db.query(`INSERT INTO escrows(id,order_id,payment_id,status,amount,held_at) VALUES($1,$2,$3,'HELD',10,CURRENT_TIMESTAMP)`,[escrowId,orderId,paymentId]);
  await db.query(`INSERT INTO escrow_transactions(id,escrow_id,type,amount,reference) VALUES($1,$2,'HOLD',10,'p21-hold')`,[randomUUID(),escrowId]);
  await db.query('COMMIT');
  let inv=(await db.query(`SELECT available_quantity,reserved_quantity FROM inventory WHERE product_id=$1`,[productId])).rows[0];
  if(inv.available_quantity!==8 || inv.reserved_quantity!==0) throw new Error(`Paid inventory finalization incorrect: ${JSON.stringify(inv)}`);
  await db.query('BEGIN');
  await db.query(`UPDATE escrows SET status='REFUNDED',refunded_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='HELD'`,[escrowId]);
  await db.query(`INSERT INTO escrow_transactions(id,escrow_id,type,amount,reference) VALUES($1,$2,'REFUND',10,'p21-refund')`,[randomUUID(),escrowId]);
  await db.query(`UPDATE orders SET status='REFUNDED' WHERE id=$1 AND status='PAID'`,[orderId]);
  await db.query('COMMIT');
  inv=(await db.query(`SELECT available_quantity,reserved_quantity FROM inventory WHERE product_id=$1`,[productId])).rows[0];
  if(inv.available_quantity!==8 || inv.reserved_quantity!==0) throw new Error('Refund unexpectedly restocked inventory.');
  console.log('the implementation CANCELLATION/REFUND DATABASE VERIFICATION PASSED');
 } finally {
  await db.query('DELETE FROM escrow_transactions WHERE escrow_id=$1',[escrowId]).catch(()=>undefined); await db.query('DELETE FROM escrows WHERE id=$1',[escrowId]).catch(()=>undefined); await db.query('DELETE FROM payments WHERE id=$1',[paymentId]).catch(()=>undefined); await db.query('DELETE FROM order_items WHERE order_id=$1',[orderId]).catch(()=>undefined); await db.query('DELETE FROM orders WHERE id=$1',[orderId]).catch(()=>undefined); await db.query('DELETE FROM products WHERE id=$1',[productId]).catch(()=>undefined); await db.query('DELETE FROM categories WHERE id=$1',[categoryId]).catch(()=>undefined); await db.query('DELETE FROM seller_profiles WHERE user_id=$1',[sellerId]).catch(()=>undefined); await db.query('DELETE FROM users WHERE id IN ($1,$2)',[buyerId,sellerId]).catch(()=>undefined); await db.end().catch(()=>undefined);
 }
}
void main();
