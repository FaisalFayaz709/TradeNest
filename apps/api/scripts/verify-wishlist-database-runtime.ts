import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required.');
const db = new Client({ connectionString });

async function main(): Promise<void> {
  await db.connect();
  const suffix = randomUUID().replaceAll('-', '');
  const buyerA = randomUUID();
  const buyerB = randomUUID();
  const sellerId = randomUUID();
  const categoryId = randomUUID();
  const productId = randomUUID();
  try {
    await db.query(`INSERT INTO users (id,email,password_hash,name,role,status) VALUES ($1,$2,'hash','Buyer A','BUYER','ACTIVE'),($3,$4,'hash','Buyer B','BUYER','ACTIVE'),($5,$6,'hash','Seller','SELLER','ACTIVE')`, [buyerA, `buyer-a-${suffix}@example.invalid`, buyerB, `buyer-b-${suffix}@example.invalid`, sellerId, `seller-${suffix}@example.invalid`]);
    await db.query(`INSERT INTO seller_profiles (user_id,store_name,slug,status) VALUES ($1,'wishlist Store',$2,'ACTIVE')`, [sellerId, `wishlist-${suffix}`]);
    await db.query(`INSERT INTO categories (id,name,slug) VALUES ($1,'wishlist Category',$2)`, [categoryId, `wishlist-cat-${suffix}`]);
    await db.query(`INSERT INTO products (id,seller_id,category_id,name,slug,description,sku,price,currency,status) VALUES ($1,$2,$3,'wishlist Product',$4,'Runtime wishlist product description',$5,19.95,'USD','ACTIVE')`, [productId, sellerId, categoryId, `wishlist-product-${suffix}`, `wishlist-${suffix}`]);

    await db.query(`INSERT INTO wishlist_items (id,user_id,product_id) VALUES ($1,$2,$3)`, [randomUUID(), buyerA, productId]);
    let duplicateRejected = false;
    try {
      await db.query(`INSERT INTO wishlist_items (id,user_id,product_id) VALUES ($1,$2,$3)`, [randomUUID(), buyerA, productId]);
    } catch (error: any) {
      if (error?.code !== '23505') throw error;
      duplicateRejected = true;
    }
    if (!duplicateRejected) throw new Error('UNIQUE(user_id, product_id) did not reject duplicate wishlist relation.');

    await db.query(`INSERT INTO wishlist_items (id,user_id,product_id) VALUES ($1,$2,$3)`, [randomUUID(), buyerB, productId]);
    const count = await db.query(`SELECT user_id, count(*)::int AS n FROM wishlist_items WHERE product_id=$1 GROUP BY user_id ORDER BY user_id`, [productId]);
    if (count.rows.length !== 2 || count.rows.some((row) => row.n !== 1)) throw new Error('Wishlist ownership/uniqueness persistence invariant failed.');

    console.log('the implementation WISHLIST DATABASE VERIFICATION PASSED');
  } finally {
    await db.query(`DELETE FROM wishlist_items WHERE product_id=$1`, [productId]).catch(() => undefined);
    await db.query(`DELETE FROM inventory WHERE product_id=$1`, [productId]).catch(() => undefined);
    await db.query(`DELETE FROM products WHERE id=$1`, [productId]).catch(() => undefined);
    await db.query(`DELETE FROM categories WHERE id=$1`, [categoryId]).catch(() => undefined);
    await db.query(`DELETE FROM seller_profiles WHERE user_id=$1`, [sellerId]).catch(() => undefined);
    await db.query(`DELETE FROM users WHERE id IN ($1,$2,$3)`, [buyerA,buyerB,sellerId]).catch(() => undefined);
    await db.end().catch(() => undefined);
  }
}

void main();
