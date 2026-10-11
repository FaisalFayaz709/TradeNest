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
  const orderId = randomUUID();
  const itemId = randomUUID();
  const reviewId = randomUUID();
  try {
    await db.query(`INSERT INTO users (id,email,password_hash,name,role,status) VALUES ($1,$2,'hash','Buyer','BUYER','ACTIVE'),($3,$4,'hash','Seller','SELLER','ACTIVE')`, [buyerId, `buyer-${suffix}@example.invalid`, sellerId, `seller-${suffix}@example.invalid`]);
    await db.query(`INSERT INTO seller_profiles (user_id,store_name,slug,status) VALUES ($1,'review Store',$2,'ACTIVE')`, [sellerId, `review-${suffix}`]);
    await db.query(`INSERT INTO categories (id,name,slug) VALUES ($1,'review Category',$2)`, [categoryId, `review-cat-${suffix}`]);
    await db.query(`INSERT INTO products (id,seller_id,category_id,name,slug,description,sku,price,currency,status) VALUES ($1,$2,$3,'review Product',$4,'Runtime review product description',$5,19.95,'USD','ACTIVE')`, [productId, sellerId, categoryId, `review-product-${suffix}`, `review-${suffix}`]);
    await db.query(`INSERT INTO orders (id,order_number,buyer_id,status,currency,subtotal,shipping_amount,discount_amount,total_amount,shipping_address,completed_at) VALUES ($1,$2,$3,'COMPLETED','USD',19.95,0,0,19.95,$4::jsonb,CURRENT_TIMESTAMP)`, [orderId, `review-${suffix}`, buyerId, JSON.stringify({ sourceAddressId: randomUUID(), recipient: 'Buyer', line1: '1 Test', line2: null, city: 'Test', region: null, postalCode: null, country: 'US', phone: null })]);
    await db.query(`INSERT INTO order_items (id,order_id,product_id,seller_id,product_name,sku,quantity,unit_price,total_price) VALUES ($1,$2,$3,$4,'review Product',$5,1,19.95,19.95)`, [itemId, orderId, productId, sellerId, `review-${suffix}`]);
    await db.query(`INSERT INTO reviews (id,order_item_id,buyer_id,product_id,rating,comment) VALUES ($1,$2,$3,$4,5,'Verified purchase')`, [reviewId, itemId, buyerId, productId]);

    const row = await db.query(`SELECT r.rating,r.product_id,o.status,o.buyer_id FROM reviews r JOIN order_items oi ON oi.id=r.order_item_id JOIN orders o ON o.id=oi.order_id WHERE r.id=$1`, [reviewId]);
    if (row.rows[0]?.rating !== 5 || row.rows[0]?.product_id !== productId || row.rows[0]?.status !== 'COMPLETED' || row.rows[0]?.buyer_id !== buyerId) {
      throw new Error('Review purchase linkage is incorrect.');
    }

    let duplicateRejected = false;
    try {
      await db.query(`INSERT INTO reviews (id,order_item_id,buyer_id,product_id,rating) VALUES ($1,$2,$3,$4,4)`, [randomUUID(), itemId, buyerId, productId]);
    } catch (error: any) {
      if (error?.code !== '23505') throw error;
      duplicateRejected = true;
    }
    if (!duplicateRejected) throw new Error('UNIQUE(order_item_id) did not reject a duplicate review.');

    let ratingRejected = false;
    const secondOrderId = randomUUID();
    const secondItemId = randomUUID();
    await db.query(`INSERT INTO orders (id,order_number,buyer_id,status,currency,subtotal,shipping_amount,discount_amount,total_amount,shipping_address,completed_at) VALUES ($1,$2,$3,'COMPLETED','USD',19.95,0,0,19.95,$4::jsonb,CURRENT_TIMESTAMP)`, [secondOrderId, `review-B-${suffix}`, buyerId, JSON.stringify({ sourceAddressId: randomUUID(), recipient: 'Buyer', line1: '1 Test', line2: null, city: 'Test', region: null, postalCode: null, country: 'US', phone: null })]);
    await db.query(`INSERT INTO order_items (id,order_id,product_id,seller_id,product_name,sku,quantity,unit_price,total_price) VALUES ($1,$2,$3,$4,'review Product',$5,1,19.95,19.95)`, [secondItemId, secondOrderId, productId, sellerId, `reviewB-${suffix}`]);
    try {
      await db.query(`INSERT INTO reviews (id,order_item_id,buyer_id,product_id,rating) VALUES ($1,$2,$3,$4,6)`, [randomUUID(), secondItemId, buyerId, productId]);
    } catch (error: any) {
      if (error?.code !== '23514') throw error;
      ratingRejected = true;
    }
    if (!ratingRejected) throw new Error('CHECK rating BETWEEN 1 AND 5 did not reject rating 6.');

    console.log('the implementation REVIEWS DATABASE VERIFICATION PASSED');
  } finally {
    await db.query(`DELETE FROM reviews WHERE buyer_id=$1`, [buyerId]).catch(() => undefined);
    await db.query(`DELETE FROM order_items WHERE seller_id=$1`, [sellerId]).catch(() => undefined);
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
