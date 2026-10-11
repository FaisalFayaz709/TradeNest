/** Seller intelligence live DB acceptance for verified-purchase recommendation integrity.
 * Refuses any database other than a localhost *_test PostgreSQL 18 instance.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { Client } from 'pg';
import { AppModule } from '../src/app.module.js';
import { AnalyticsService } from '../src/modules/analytics/analytics.service.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || process.env.DATABASE_URL !== url || process.env.NODE_ENV !== 'test') {
  throw new Error('Seller intelligence requires NODE_ENV=test and DATABASE_URL=TEST_DATABASE_URL.');
}
const parsed = new URL(url);
if (!['postgres:', 'postgresql:'].includes(parsed.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
    || !/^tradenest(?:_[a-z0-9]+)*_test$/.test(parsed.pathname.slice(1))
    || parsed.searchParams.get('schema') !== 'public') {
  throw new Error('Refusing non-local, non-test or non-public-schema database.');
}

const db = new Client({ connectionString: url });
await db.connect();
let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>> | null = null;
const buyerId = randomUUID(), sellerId = randomUUID(), categoryId = randomUUID();
const productId = randomUUID(), orderId = randomUUID(), paymentId = randomUUID();
const suffix = randomUUID().replaceAll('-', '');
let checks = 0;
try {
  const server = await db.query<{ version: number }>("SELECT current_setting('server_version_num')::int AS version");
  assert.ok(server.rows[0]!.version >= 180000 && server.rows[0]!.version < 190000, 'PostgreSQL 18 required');
  app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const analytics = app.get(AnalyticsService);

  await db.query(`INSERT INTO users (id,email,password_hash,name,role,status) VALUES
    ($1,$2,'hash','Seller intelligence Buyer','BUYER','ACTIVE'),($3,$4,'hash','Seller intelligence Seller','SELLER','ACTIVE')`,
    [buyerId, `seller intelligence-buyer-${suffix}@example.test`, sellerId, `seller intelligence-seller-${suffix}@example.test`]);
  await db.query(`INSERT INTO categories (id,name,slug) VALUES ($1,'Seller intelligence Category',$2)`, [categoryId, `seller intelligence-${suffix}`]);
  await db.query(`INSERT INTO products (id,seller_id,category_id,name,slug,description,price,currency,sku,status)
    VALUES ($1,$2,$3,'Seller intelligence Product',$4,'Isolated integration test product only',15.00,'USD','SELLER INTELLIGENCE','ACTIVE')`,
    [productId,sellerId,categoryId,`seller intelligence-product-${suffix}`]);

  // Legacy or attacker-created purchase events must not become recommendation history.
  await db.query(`INSERT INTO user_events (id,user_id,product_id,event_type)
    VALUES ($1,$2,$3,'PURCHASE')`, [randomUUID(),buyerId,productId]);
  let events = await analytics.recentRecommendationEvents(buyerId, 20);
  assert.equal(events.some(event => event.eventType === 'PURCHASE'), false, 'Unverified purchase row counted'); checks++;
  await assert.rejects(
    analytics.ingestBehaviorEvent(undefined, { eventType: 'PURCHASE', productId }),
    /Purchase signals are derived/,
  ); checks++;

  await db.query(`INSERT INTO orders
    (id,order_number,buyer_id,status,currency,subtotal,shipping_amount,discount_amount,total_amount,shipping_address,paid_at)
    VALUES ($1,$2,$3,'PAID','USD',15,0,0,15,'{}'::jsonb,now())`,
    [orderId,`SELLER INTELLIGENCE-${suffix}`,buyerId]);
  await db.query(`INSERT INTO order_items
    (id,order_id,product_id,seller_id,product_name,sku,quantity,unit_price,total_price)
    VALUES ($1,$2,$3,$4,'Seller intelligence Product','SELLER INTELLIGENCE',1,15,15)`,
    [randomUUID(),orderId,productId,sellerId]);
  await db.query(`INSERT INTO payments
    (id,order_id,buyer_id,provider,provider_payment_id,status,amount,currency,paid_at)
    VALUES ($1,$2,$3,'sandbox',$4,'SUCCEEDED',15,'USD',now())`,
    [paymentId,orderId,buyerId,`seller_intelligence_verified_${suffix}`]);
  events = await analytics.recentRecommendationEvents(buyerId, 20);
  assert.equal(events.filter(event => event.eventType === 'PURCHASE').length, 1,
    'Verified payment must generate exactly one purchase signal per order item'); checks++;

  await db.query("UPDATE orders SET status='REFUNDED' WHERE id=$1", [orderId]);
  events = await analytics.recentRecommendationEvents(buyerId,20);
  assert.equal(events.some(event => event.eventType === 'PURCHASE'), false,
    'Refunded order must not contribute purchase history'); checks++;
  console.log(`SELLER INTELLIGENCE LIVE VERIFIED-PURCHASE TEST PASSED: ${checks} state/ownership checks`);
} finally {
  await app?.close().catch(() => undefined);
  // Disposable fixtures only. Test databases are isolated and never shared.
  await db.query('DELETE FROM payments WHERE id=$1', [paymentId]).catch(() => undefined);
  await db.query('DELETE FROM order_items WHERE order_id=$1', [orderId]).catch(() => undefined);
  await db.query('DELETE FROM orders WHERE id=$1', [orderId]).catch(() => undefined);
  await db.query('DELETE FROM user_events WHERE product_id=$1', [productId]).catch(() => undefined);
  await db.query('DELETE FROM products WHERE id=$1', [productId]).catch(() => undefined);
  await db.query('DELETE FROM categories WHERE id=$1', [categoryId]).catch(() => undefined);
  await db.query('DELETE FROM users WHERE id IN ($1,$2)', [buyerId,sellerId]).catch(() => undefined);
  await db.end();
}
