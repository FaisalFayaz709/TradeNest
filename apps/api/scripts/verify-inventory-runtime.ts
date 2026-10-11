import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required.');

const setup = new Client({ connectionString });
const buyerA = new Client({ connectionString });
const buyerB = new Client({ connectionString });

const sellerId = randomUUID();
const categoryId = randomUUID();
const productId = randomUUID();
const unique = randomUUID().replaceAll('-', '');

async function reserve(client: Client, quantity: number): Promise<number> {
  const result = await client.query(
    `UPDATE inventory
       SET available_quantity = available_quantity - $2,
           reserved_quantity = reserved_quantity + $2,
           updated_at = CURRENT_TIMESTAMP
     WHERE product_id = $1
       AND available_quantity >= $2`,
    [productId, quantity],
  );
  return result.rowCount ?? 0;
}

async function main(): Promise<void> {
  await Promise.all([setup.connect(), buyerA.connect(), buyerB.connect()]);

  try {
    await setup.query(
    `INSERT INTO users (id, email, password_hash, name, role, status)
     VALUES ($1, $2, 'runtime-verifier-not-a-real-password-hash', 'Inventory Verifier', 'SELLER', 'ACTIVE')`,
    [sellerId, `inventory-${unique}@example.invalid`],
  );
  await setup.query(
    `INSERT INTO categories (id, name, slug) VALUES ($1, 'Runtime Inventory', $2)`,
    [categoryId, `runtime-inventory-${unique}`],
  );
  await setup.query(
    `INSERT INTO products
       (id, seller_id, category_id, name, slug, description, price, currency, sku, status)
     VALUES
       ($1, $2, $3, 'Runtime Inventory Product', $4,
        'Runtime-only product used to verify conditional inventory updates.',
        1.00, 'USD', $5, 'ACTIVE')`,
    [productId, sellerId, categoryId, `runtime-product-${unique}`, `runtime-sku-${unique}`],
  );
  await setup.query(
    `INSERT INTO inventory (product_id, available_quantity, reserved_quantity)
     VALUES ($1, 1, 0)`,
    [productId],
  );

  const [a, b] = await Promise.all([reserve(buyerA, 1), reserve(buyerB, 1)]);
  if (a + b !== 1) throw new Error(`Expected exactly one concurrent reservation to succeed; got ${a + b}.`);

  let row = await setup.query<{ available_quantity: number; reserved_quantity: number }>(
    `SELECT available_quantity, reserved_quantity FROM inventory WHERE product_id = $1`,
    [productId],
  );
  if (row.rows[0]?.available_quantity !== 0 || row.rows[0]?.reserved_quantity !== 1) {
    throw new Error('Concurrent reservation did not produce available=0/reserved=1.');
  }

  const overReserve = await reserve(setup, 1);
  if (overReserve !== 0) throw new Error('Out-of-stock reservation unexpectedly succeeded.');

  const release = await setup.query(
    `UPDATE inventory
       SET available_quantity = available_quantity + 1,
           reserved_quantity = reserved_quantity - 1,
           updated_at = CURRENT_TIMESTAMP
     WHERE product_id = $1 AND reserved_quantity >= 1`,
    [productId],
  );
  if ((release.rowCount ?? 0) !== 1) throw new Error('Valid reservation release failed.');

  const overRelease = await setup.query(
    `UPDATE inventory
       SET available_quantity = available_quantity + 1,
           reserved_quantity = reserved_quantity - 1,
           updated_at = CURRENT_TIMESTAMP
     WHERE product_id = $1 AND reserved_quantity >= 1`,
    [productId],
  );
  if ((overRelease.rowCount ?? 0) !== 0) throw new Error('Reservation underflow protection failed.');

  if ((await reserve(setup, 1)) !== 1) throw new Error('Second valid reservation failed.');
  const consume = await setup.query(
    `UPDATE inventory
       SET reserved_quantity = reserved_quantity - 1,
           updated_at = CURRENT_TIMESTAMP
     WHERE product_id = $1 AND reserved_quantity >= 1`,
    [productId],
  );
  if ((consume.rowCount ?? 0) !== 1) throw new Error('Reservation consumption failed.');

  row = await setup.query<{ available_quantity: number; reserved_quantity: number }>(
    `SELECT available_quantity, reserved_quantity FROM inventory WHERE product_id = $1`,
    [productId],
  );
  if (row.rows[0]?.available_quantity !== 0 || row.rows[0]?.reserved_quantity !== 0) {
    throw new Error('Reservation consumption did not produce available=0/reserved=0.');
  }

  console.log('INVENTORY CONCURRENCY RUNTIME VERIFICATION PASSED');
} finally {
  await setup.query('DELETE FROM products WHERE id = $1', [productId]).catch(() => undefined);
  await setup.query('DELETE FROM categories WHERE id = $1', [categoryId]).catch(() => undefined);
  await setup.query('DELETE FROM users WHERE id = $1', [sellerId]).catch(() => undefined);
  await Promise.all([
    setup.end().catch(() => undefined),
    buyerA.end().catch(() => undefined),
    buyerB.end().catch(() => undefined),
  ]);
  }
}

void main();
