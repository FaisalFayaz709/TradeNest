import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required.');

const setup = new Client({ connectionString });
const creatorA = new Client({ connectionString });
const creatorB = new Client({ connectionString });

const buyerId = randomUUID();
const otherBuyerId = randomUUID();
const sellerId = randomUUID();
const categoryId = randomUUID();
const productId = randomUUID();
const unique = randomUUID().replaceAll('-', '');

async function tryCreateCart(client: Client, userId: string): Promise<boolean> {
  try {
    await client.query('INSERT INTO carts (id, user_id, is_active) VALUES ($1, $2, true)', [randomUUID(), userId]);
    return true;
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : undefined;
    if (code === '23505') return false;
    throw error;
  }
}

async function main(): Promise<void> {
  await Promise.all([setup.connect(), creatorA.connect(), creatorB.connect()]);

  try {
    await setup.query(
      `INSERT INTO users (id, email, password_hash, name, role, status)
       VALUES ($1, $2, 'runtime-verifier-not-a-real-password-hash', 'Cart Buyer', 'BUYER', 'ACTIVE'),
              ($3, $4, 'runtime-verifier-not-a-real-password-hash', 'Other Buyer', 'BUYER', 'ACTIVE'),
              ($5, $6, 'runtime-verifier-not-a-real-password-hash', 'Cart Seller', 'SELLER', 'ACTIVE')`,
      [
        buyerId, `cart-buyer-${unique}@example.invalid`,
        otherBuyerId, `cart-other-${unique}@example.invalid`,
        sellerId, `cart-seller-${unique}@example.invalid`,
      ],
    );

    const [a, b] = await Promise.all([tryCreateCart(creatorA, buyerId), tryCreateCart(creatorB, buyerId)]);
    if (Number(a) + Number(b) !== 1) {
      throw new Error(`Expected exactly one active-cart create to succeed; got ${Number(a) + Number(b)}.`);
    }

    const active = await setup.query<{ id: string }>('SELECT id FROM carts WHERE user_id = $1 AND is_active = true', [buyerId]);
    if (active.rowCount !== 1) throw new Error(`Expected exactly one active cart, got ${active.rowCount ?? 0}.`);
    const cartId = active.rows[0]!.id;

    const otherCartId = randomUUID();
    await setup.query('INSERT INTO carts (id, user_id, is_active) VALUES ($1, $2, true)', [otherCartId, otherBuyerId]);

    await setup.query('INSERT INTO categories (id, name, slug) VALUES ($1, $2, $3)', [categoryId, 'Cart Runtime', `cart-runtime-${unique}`]);
    await setup.query(
      `INSERT INTO products
        (id, seller_id, category_id, name, slug, description, price, currency, sku, status)
       VALUES ($1, $2, $3, 'Cart Runtime Product', $4,
        'Runtime-only product used to verify cart database invariants.',
        1.00, 'USD', $5, 'ACTIVE')`,
      [productId, sellerId, categoryId, `cart-product-${unique}`, `cart-sku-${unique}`],
    );
    await setup.query('INSERT INTO inventory (product_id, available_quantity, reserved_quantity) VALUES ($1, 5, 0)', [productId]);

    const itemId = randomUUID();
    await setup.query(
      'INSERT INTO cart_items (id, cart_id, product_id, quantity) VALUES ($1, $2, $3, 1)',
      [itemId, cartId, productId],
    );

    let duplicateRejected = false;
    try {
      await setup.query(
        'INSERT INTO cart_items (id, cart_id, product_id, quantity) VALUES ($1, $2, $3, 1)',
        [randomUUID(), cartId, productId],
      );
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : undefined;
      duplicateRejected = code === '23505';
      if (!duplicateRejected) throw error;
    }
    if (!duplicateRejected) throw new Error('Duplicate product row in the same cart was not rejected.');

    let nonPositiveRejected = false;
    try {
      await setup.query(
        'INSERT INTO cart_items (id, cart_id, product_id, quantity) VALUES ($1, $2, $3, 0)',
        [randomUUID(), otherCartId, productId],
      );
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : undefined;
      nonPositiveRejected = code === '23514';
      if (!nonPositiveRejected) throw error;
    }
    if (!nonPositiveRejected) throw new Error('Non-positive cart quantity was not rejected.');

    const crossCartUpdate = await setup.query(
      'UPDATE cart_items SET quantity = 2 WHERE id = $1 AND cart_id = $2',
      [itemId, otherCartId],
    );
    if ((crossCartUpdate.rowCount ?? 0) !== 0) throw new Error('Cart-scoped ownership predicate unexpectedly updated another cart item.');

    console.log('CART DATABASE RUNTIME VERIFICATION PASSED');
  } finally {
    // Delete buyers first so their carts/cart items cascade away, then remove
    // the product before deleting the seller/category protected by RESTRICT FKs.
    await setup.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[buyerId, otherBuyerId]]).catch(() => undefined);
    await setup.query('DELETE FROM products WHERE id = $1', [productId]).catch(() => undefined);
    await setup.query('DELETE FROM categories WHERE id = $1', [categoryId]).catch(() => undefined);
    await setup.query('DELETE FROM users WHERE id = $1', [sellerId]).catch(() => undefined);
    await Promise.all([
      setup.end().catch(() => undefined),
      creatorA.end().catch(() => undefined),
      creatorB.end().catch(() => undefined),
    ]);
  }
}

void main();
