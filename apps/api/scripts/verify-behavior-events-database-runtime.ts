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
  const categoryId = randomUUID();
  const productId = randomUUID();
  try {
    await db.query(
      `INSERT INTO users (id,email,password_hash,name,role,status) VALUES ($1,$2,'hash','Buyer','BUYER','ACTIVE'),($3,$4,'hash','Seller','SELLER','ACTIVE')`,
      [buyerId, `event-buyer-${suffix}@example.invalid`, sellerId, `event-seller-${suffix}@example.invalid`],
    );
    await db.query(`INSERT INTO seller_profiles (user_id,store_name,slug,status) VALUES ($1,'behavior Store',$2,'ACTIVE')`, [sellerId, `behavior-${suffix}`]);
    await db.query(`INSERT INTO categories (id,name,slug) VALUES ($1,'behavior Category',$2)`, [categoryId, `behavior-cat-${suffix}`]);
    await db.query(
      `INSERT INTO products (id,seller_id,category_id,name,slug,description,sku,price,currency,status) VALUES ($1,$2,$3,'behavior Product',$4,'Runtime behavior event product description',$5,19.95,'USD','ACTIVE')`,
      [productId, sellerId, categoryId, `behavior-product-${suffix}`, `behavior-${suffix}`],
    );

    await db.query(`INSERT INTO user_events (id,user_id,product_id,event_type) VALUES ($1,NULL,$2,'PRODUCT_VIEW')`, [randomUUID(), productId]);
    for (const eventType of ['WISHLIST', 'ADD_TO_CART', 'PURCHASE']) {
      await db.query(`INSERT INTO user_events (id,user_id,product_id,event_type) VALUES ($1,$2,$3,$4)`, [randomUUID(), buyerId, productId, eventType]);
    }
    const rows = await db.query(`SELECT user_id,event_type FROM user_events WHERE product_id=$1 ORDER BY occurred_at,id`, [productId]);
    if (rows.rows.length !== 4) throw new Error('Expected four behavior-event rows.');
    if (rows.rows[0]?.user_id !== null) throw new Error('Anonymous event user_id must remain nullable.');
    const observed = new Set(rows.rows.map((row) => row.event_type));
    for (const expected of ['PRODUCT_VIEW', 'WISHLIST', 'ADD_TO_CART', 'PURCHASE']) {
      if (!observed.has(expected)) throw new Error(`Missing behavior_event_type ${expected}.`);
    }

    console.log('the implementation BEHAVIOR EVENT DATABASE VERIFICATION PASSED');
  } finally {
    await db.query(`DELETE FROM user_events WHERE product_id=$1`, [productId]).catch(() => undefined);
    await db.query(`DELETE FROM inventory WHERE product_id=$1`, [productId]).catch(() => undefined);
    await db.query(`DELETE FROM products WHERE id=$1`, [productId]).catch(() => undefined);
    await db.query(`DELETE FROM categories WHERE id=$1`, [categoryId]).catch(() => undefined);
    await db.query(`DELETE FROM seller_profiles WHERE user_id=$1`, [sellerId]).catch(() => undefined);
    await db.query(`DELETE FROM users WHERE id IN ($1,$2)`, [buyerId, sellerId]).catch(() => undefined);
    await db.end().catch(() => undefined);
  }
}

void main();
