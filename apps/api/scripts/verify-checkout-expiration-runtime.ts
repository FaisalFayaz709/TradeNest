/** Live PostgreSQL 18 Checkout expiration test. Isolated local test DB only. */
import 'dotenv/config';
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { OrderExpirationService } from '../src/modules/orders/order-expiration.service.js';

const url = process.env.DATABASE_URL;
const dedicated = process.env.TEST_DATABASE_URL;
if (!url || !dedicated || url !== dedicated) throw new Error('Checkout requires DATABASE_URL === TEST_DATABASE_URL');
const parsed = new URL(url);
if (!['127.0.0.1','localhost','::1'].includes(parsed.hostname) || !/_test$/.test(parsed.pathname.slice(1))) {
  throw new Error('Checkout refuses nonlocal or non-test databases');
}
const db = new Client({connectionString:url});
const ids = {buyer:randomUUID(), seller:randomUUID(), category:randomUUID(), product:randomUUID(), expired:randomUUID(), external:randomUUID(), future:randomUUID()};
const marker = randomUUID().replaceAll('-','');
const orderNumbers = {expired:`P5-A-${marker.slice(0,16)}`,external:`P5-B-${marker.slice(0,16)}`,future:`P5-C-${marker.slice(0,16)}`};
let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>> | null = null;
async function seed() {
  await db.query(`INSERT INTO users(id,email,password_hash,name,role,status) VALUES ($1,$2,'x','Buyer','BUYER','ACTIVE'),($3,$4,'x','Seller','SELLER','ACTIVE')`,[ids.buyer,`checkout-b-${marker}@x.invalid`,ids.seller,`checkout-s-${marker}@x.invalid`]);
  await db.query(`INSERT INTO seller_profiles(user_id,store_name,slug,status) VALUES($1,'Checkout',$2,'ACTIVE')`,[ids.seller,`checkout-${marker}`]);
  await db.query(`INSERT INTO categories(id,name,slug) VALUES($1,'Checkout',$2)`,[ids.category,`checkout-cat-${marker}`]);
  await db.query(`INSERT INTO products(id,seller_id,category_id,name,slug,description,price,currency,sku,status) VALUES($1,$2,$3,'Checkout product',$4,'Expiration test product with sufficient text.',5,'USD',$5,'ACTIVE')`,[ids.product,ids.seller,ids.category,`checkout-prod-${marker}`,`P5-${marker}`]);
  await db.query(`INSERT INTO inventory(product_id,available_quantity,reserved_quantity) VALUES($1,5,4)`,[ids.product]);
  for (const [orderId,orderNumber,offsetMinutes,quantity,provider] of [
    [ids.expired, orderNumbers.expired, -60, 2, 'INTERNAL_PENDING'],
    [ids.external, orderNumbers.external, -60, 1, 'sandbox'],
    [ids.future, orderNumbers.future, 60, 1, 'INTERNAL_PENDING'],
  ] as const) {
    const deadline = new Date(Date.now() + offsetMinutes * 60_000);
    await db.query(`INSERT INTO orders(id,order_number,buyer_id,status,currency,subtotal,shipping_amount,discount_amount,total_amount,shipping_address,payment_expires_at) VALUES($1,$2,$3,'PENDING_PAYMENT','USD',$4,0,0,$4,$5::jsonb,$6)`,[orderId,orderNumber,ids.buyer,quantity*5,JSON.stringify({recipient:'Buyer'}),deadline]);
    await db.query(`INSERT INTO order_items(id,order_id,product_id,seller_id,product_name,sku,quantity,unit_price,total_price) VALUES($1,$2,$3,$4,'Checkout product',$5,$6,5,$7)`,[randomUUID(),orderId,ids.product,ids.seller,`P5-${marker}`,quantity,quantity*5]);
    await db.query(`INSERT INTO payments(id,order_id,buyer_id,provider,provider_payment_id,status,amount,currency) VALUES($1,$2,$3,$4,$5,'PENDING',$6,'USD')`,[randomUUID(),orderId,ids.buyer,provider,`p5-${randomUUID()}`,quantity*5]);
  }
}
async function cleanup() {
  const orderIds=[ids.expired,ids.external,ids.future];
  await db.query('DELETE FROM payments WHERE order_id = ANY($1::uuid[])',[orderIds]);
  await db.query('DELETE FROM order_items WHERE order_id = ANY($1::uuid[])',[orderIds]);
  await db.query('DELETE FROM orders WHERE id = ANY($1::uuid[])',[orderIds]);
  await db.query('DELETE FROM inventory WHERE product_id=$1',[ids.product]);
  await db.query('DELETE FROM products WHERE id=$1',[ids.product]);
  await db.query('DELETE FROM categories WHERE id=$1',[ids.category]);
  await db.query('DELETE FROM seller_profiles WHERE user_id=$1',[ids.seller]);
  await db.query('DELETE FROM users WHERE id IN ($1,$2)',[ids.buyer,ids.seller]);
}
async function main() {
  await db.connect();
  try {
    await seed();
    // Do not start background intervals when running an isolated acceptance suite.
    process.env.CHECKOUT_EXPIRY_SWEEP_ENABLED='false';
    process.env.NODE_ENV='test';
    app=await NestFactory.createApplicationContext(AppModule,{logger:false});
    const sweeper=app.get(OrderExpirationService);
    const first=await sweeper.sweepOnce(new Date(),200);
    if (first.expired !== 1 || first.skippedProviderPending !== 1) throw new Error(`Incorrect first sweep result: ${JSON.stringify(first)}`);
    // Reset cursor then race two extra worker attempts. Conditional status/locks must prevent double release.
    await sweeper.sweepOnce(new Date(),200);
    await Promise.all([sweeper.sweepOnce(new Date(),200),sweeper.sweepOnce(new Date(),200)]);
    const statuses=await db.query(`SELECT id,status FROM orders WHERE id=ANY($1::uuid[])`,[[ids.expired,ids.external,ids.future]]);
    const byId=new Map(statuses.rows.map((r:{id:string;status:string})=>[r.id,r.status]));
    if(byId.get(ids.expired)!=='CANCELLED'||byId.get(ids.external)!=='PENDING_PAYMENT'||byId.get(ids.future)!=='PENDING_PAYMENT') {
      throw new Error(`Unexpected expiration states: ${JSON.stringify([...byId])}`);
    }
    const inventory=(await db.query('SELECT available_quantity,reserved_quantity FROM inventory WHERE product_id=$1',[ids.product])).rows[0];
    if(inventory.available_quantity!==7 || inventory.reserved_quantity!==2) throw new Error(`Inventory not restored exactly once: ${JSON.stringify(inventory)}`);
    console.log('CHECKOUT LIVE EXPIRATION TEST PASSED: expiration, pending external protection, future deadline, repeated worker safety, inventory release.');
  } finally {
    if(app) await app.close();
    try { await cleanup(); } finally { await db.end(); }
  }
}
void main().catch((error:unknown)=>{console.error(error);process.exitCode=1;});
