/**
 * TradeNest Database PostgreSQL 18 integration verification.
 * Intentionally runs on an isolated, local *_test database only.
 * Verifies real constraints, financial precision, rollback and the atomic
 * stock-reservation SQL pattern. Does NOT claim full checkout service coverage.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const urlString = process.env.TEST_DATABASE_URL;
if (!urlString) throw new Error('TEST_DATABASE_URL is required');
const url = new URL(urlString);
const databaseName = decodeURIComponent(url.pathname.substring(1));
if (
  !['postgres:', 'postgresql:'].includes(url.protocol) ||
  !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
  !/^tradenest(?:_[a-z0-9]+)*_test$/.test(databaseName) ||
  (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public')
) {
  throw new Error('Refusing Database database tests on a non-local, non-disposable *_test database');
}

const connectionString = urlString;
const client = new Client({ connectionString, statement_timeout: 10_000 });
let assertionCount = 0;
const ids = {
  buyer: randomUUID(), seller: randomUUID(), category: randomUUID(),
  product: randomUUID(), cart: randomUUID(), order: randomUUID(),
  item: randomUUID(), payment: randomUUID(), escrow: randomUUID(),
};
const suffix = randomUUID().slice(0, 12);
const email = `database-${suffix}@test.tradenest.invalid`;
const slug = `database-product-${suffix}`;

function check(condition: unknown, message: string): asserts condition {
  assert.ok(condition, message);
  assertionCount++;
}
async function inspectSchema(): Promise<void> {
  const server = await client.query<{ n: number; db: string }>(
    'SELECT current_setting(\'server_version_num\')::int AS n, current_database() AS db',
  );
  check(server.rows[0].n >= 180000 && server.rows[0].n < 190000, `PostgreSQL 18 is required, got ${server.rows[0].n}`);
  check(server.rows[0].db === databaseName, 'Database connection does not point to the intended test database');

  const tables = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  const tableSet = new Set(tables.rows.map((r) => r.table_name));
  for (const name of [
    'users', 'user_sessions', 'seller_profiles', 'addresses', 'categories', 'products',
    'product_images', 'inventory', 'carts', 'cart_items', 'orders', 'order_items',
    'payments', 'escrows', 'escrow_transactions', 'shipments', 'disputes',
    'dispute_messages', 'dispute_evidence', 'wishlist_items', 'reviews', 'user_events',
    'ai_recommendations', 'fraud_assessments', 'notifications', 'audit_logs',
    'idempotency_records',
  ]) check(tableSet.has(name), `Missing TradeNest table: ${name}`);

  const constraints = await client.query<{ name: string; validated: boolean; kind: string }>(`
    SELECT c.conname AS name, c.convalidated AS validated, c.contype::text AS kind
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public'
  `);
  const constraintMap = new Map(constraints.rows.map((r) => [r.name, r]));
  for (const name of [
    'products_price_nonnegative_check', 'inventory_available_nonnegative_check',
    'inventory_reserved_nonnegative_check', 'cart_items_quantity_positive_check',
    'order_items_quantity_positive_check', 'payments_amount_positive_check',
    'seller_profiles_rating_range_check', 'reviews_rating_range_check',
  ]) {
    check(constraintMap.get(name)?.kind === 'c' && constraintMap.get(name)?.validated, `Missing/unvalidated CHECK: ${name}`);
  }
  for (const name of [
    'products_seller_id_fkey', 'products_category_id_fkey', 'inventory_product_id_fkey',
    'orders_buyer_id_fkey', 'order_items_order_id_fkey', 'order_items_product_id_fkey',
    'payments_order_id_fkey', 'escrows_order_id_fkey', 'escrows_payment_id_fkey',
    'escrow_transactions_escrow_id_fkey', 'reviews_order_item_id_fkey',
    'disputes_order_id_fkey', 'idempotency_records_user_id_fkey',
  ]) check(constraintMap.get(name)?.kind === 'f' && constraintMap.get(name)?.validated, `Missing/unvalidated FK: ${name}`);

  const indexes = await client.query<{ indexname: string; indexdef: string }>(
    `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'`,
  );
  const indexMap = new Map(indexes.rows.map((r) => [r.indexname, r.indexdef]));
  for (const name of [
    'users_email_key', 'products_slug_key', 'cart_items_cart_product_key',
    'orders_order_number_key', 'payments_provider_payment_id_key',
    'escrows_order_id_key', 'disputes_order_id_key',
    'reviews_order_item_id_key', 'idempotency_records_user_operation_key_key',
    'products_seller_status_idx', 'products_category_status_idx',
    'orders_buyer_status_created_idx', 'escrows_order_status_idx',
    'user_events_user_type_time_idx', 'user_events_product_type_time_idx',
  ]) check(indexMap.has(name), `Missing unique or lookup index: ${name}`);
  const activeCartDef = indexMap.get('carts_one_active_per_user_key') ?? '';
  check(/unique index/i.test(activeCartDef) && /where\s+.*is_active\s*=\s*true/i.test(activeCartDef),
    'Active carts must use a unique partial index per user');

  const amountColumns = await client.query<{
    table_name: string; column_name: string; numeric_precision: number; numeric_scale: number;
  }>(`SELECT table_name, column_name, numeric_precision, numeric_scale
      FROM information_schema.columns WHERE table_schema = 'public' AND data_type = 'numeric'`);
  const amountMap = new Map(amountColumns.rows.map((r) => [`${r.table_name}.${r.column_name}`, r]));
  for (const name of [
    'orders.subtotal', 'orders.shipping_amount', 'orders.discount_amount',
    'orders.total_amount', 'order_items.total_price', 'payments.amount',
    'escrows.amount', 'escrow_transactions.amount',
  ]) {
    const col = amountMap.get(name);
    check(col?.numeric_precision === 30 && col?.numeric_scale === 2, `${name} must use NUMERIC(30,2)`);
  }
  const productPrice = amountMap.get('products.price');
  check(productPrice?.numeric_precision === 12 && productPrice?.numeric_scale === 2,
    'products.price must retain blueprint NUMERIC(12,2)');
  const snapshotFields = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='order_items'`,
  );
  const snapshotSet = new Set(snapshotFields.rows.map((r) => r.column_name));
  for (const name of ['product_name', 'sku', 'quantity', 'unit_price', 'total_price', 'seller_id']) {
    check(snapshotSet.has(name), `Order-item snapshot field missing: ${name}`);
  }
  const migrations = await client.query<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>(
    `SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`,
  );
  for (const name of [
    '202610050001_database_foundation', '202610050002_checkout_idempotency',
    '202610050003_financial_idempotency_hardening', '202610050004_audit_financial_amount_precision',
  ]) {
    check(migrations.rows.some((r) => r.migration_name === name && r.finished_at && !r.rolled_back_at),
      `Historical migration is not successfully applied: ${name}`);
  }
}

async function expectPostgresError(
  name: string, sql: string, params: readonly unknown[], expectedCode: string,
): Promise<void> {
  await client.query('SAVEPOINT database_negative_test');
  let actualCode: string | undefined;
  try {
    await client.query(sql, [...params]);
  } catch (error) {
    actualCode = (error as { code?: string }).code;
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT database_negative_test');
    await client.query('RELEASE SAVEPOINT database_negative_test');
  }
  check(actualCode === expectedCode,
    `${name}: expected SQLSTATE ${expectedCode}, got ${actualCode ?? 'successful write'}`);
}

async function makeFixtures(): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO users (id, email, password_hash, name, role, status)
       VALUES ($1,$2,'test-only-not-a-login-hash','Database Buyer','BUYER','ACTIVE'),
              ($3,$4,'test-only-not-a-login-hash','Database Seller','SELLER','ACTIVE')`,
      [ids.buyer, email, ids.seller, `seller-${email}`],
    );
    await client.query('INSERT INTO categories (id, name, slug) VALUES ($1,$2,$3)',
      [ids.category, 'Database category', `database-category-${suffix}`]);
    await client.query(
      `INSERT INTO products (id, seller_id, category_id, name, slug, description, price, currency, sku, status)
       VALUES ($1,$2,$3,'Database fixture',$4,'Database test product description',100.00,'USD',$5,'ACTIVE')`,
      [ids.product, ids.seller, ids.category, slug, `DATABASE-${suffix}`],
    );
    await client.query('INSERT INTO inventory (product_id, available_quantity, reserved_quantity) VALUES ($1,1,0)',
      [ids.product]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function validateIntegrity(): Promise<void> {
  await client.query('BEGIN');
  try {
    await expectPostgresError('Product price cannot be negative',
      'UPDATE products SET price=-1 WHERE id=$1', [ids.product], '23514');
    await expectPostgresError('Available inventory cannot be negative',
      'UPDATE inventory SET available_quantity=-1 WHERE product_id=$1', [ids.product], '23514');
    await expectPostgresError('Reserved inventory cannot be negative',
      'UPDATE inventory SET reserved_quantity=-1 WHERE product_id=$1', [ids.product], '23514');
    await expectPostgresError('Product slug is globally unique',
      `INSERT INTO products (id,seller_id,category_id,name,slug,description,price,currency,sku,status)
       VALUES ($1,$2,$3,'Duplicate slug',$4,'Duplicate test',100.00,'USD','DUP','DRAFT')`,
      [randomUUID(), ids.seller, ids.category, slug], '23505');
    await expectPostgresError('Product seller FK is enforced',
      'UPDATE products SET seller_id=$1 WHERE id=$2', [randomUUID(), ids.product], '23503');
    await expectPostgresError('User email uniqueness',
      `INSERT INTO users (id,email,password_hash,name,role,status)
       VALUES ($1,$2,'test-only','Duplicate email','BUYER','ACTIVE')`,
      [randomUUID(), email], '23505');

    await client.query('INSERT INTO seller_profiles (user_id, store_name, slug, status, rating) VALUES ($1,$2,$3,$4,$5)',
      [ids.seller, 'Database store', `database-store-${suffix}`, 'ACTIVE', 4]);
    await expectPostgresError('Seller rating 1–5',
      'UPDATE seller_profiles SET rating=6 WHERE user_id=$1', [ids.seller], '23514');
    await client.query('INSERT INTO carts (id, user_id, is_active) VALUES ($1,$2,true)', [ids.cart, ids.buyer]);
    await expectPostgresError('Exactly one active cart per user',
      'INSERT INTO carts (id, user_id, is_active) VALUES ($1,$2,true)', [randomUUID(), ids.buyer], '23505');
    await client.query('INSERT INTO carts (id, user_id, is_active) VALUES ($1,$2,false)', [randomUUID(), ids.buyer]);
    const cartItemId = randomUUID();
    await client.query('INSERT INTO cart_items (id,cart_id,product_id,quantity) VALUES ($1,$2,$3,1)',
      [cartItemId, ids.cart, ids.product]);
    await expectPostgresError('Cart quantity positive',
      'UPDATE cart_items SET quantity=0 WHERE id=$1', [cartItemId], '23514');
    await expectPostgresError('Unique product per cart',
      'INSERT INTO cart_items (id,cart_id,product_id,quantity) VALUES ($1,$2,$3,1)',
      [randomUUID(), ids.cart, ids.product], '23505');

    await client.query(
      `INSERT INTO orders (id,order_number,buyer_id,status,currency,subtotal,shipping_amount,
       discount_amount,total_amount,shipping_address)
       VALUES ($1,$2,$3,'PENDING_PAYMENT','USD',99999999000000.00,0,0,99999999000000.00,'{}'::jsonb)`,
      [ids.order, `DATABASE-${suffix}`, ids.buyer],
    );
    await client.query(
      `INSERT INTO order_items (id,order_id,product_id,seller_id,product_name,sku,quantity,unit_price,total_price)
       VALUES ($1,$2,$3,$4,'Snapshot product','SNAP',1,100.00,99999999000000.00)`,
      [ids.item, ids.order, ids.product, ids.seller],
    );
    await expectPostgresError('Order-item quantity positive',
      'UPDATE order_items SET quantity=0 WHERE id=$1', [ids.item], '23514');
    await expectPostgresError('Order-item seller FK',
      'UPDATE order_items SET seller_id=$1 WHERE id=$2', [randomUUID(), ids.item], '23503');
    await client.query(
      `INSERT INTO payments (id,order_id,buyer_id,provider,provider_payment_id,status,amount,currency)
       VALUES ($1,$2,$3,'sandbox',$4,'PENDING',99999999000000.00,'USD')`,
      [ids.payment, ids.order, ids.buyer, `database-provider-${suffix}`],
    );
    await expectPostgresError('Payment amount positive',
      'UPDATE payments SET amount=-1 WHERE id=$1', [ids.payment], '23514');
    await expectPostgresError('Provider payment ID unique',
      `INSERT INTO payments (id,order_id,buyer_id,provider,provider_payment_id,status,amount,currency)
       VALUES ($1,$2,$3,'sandbox',$4,'PENDING',100.00,'USD')`,
      [randomUUID(), ids.order, ids.buyer, `database-provider-${suffix}`], '23505');
    await client.query(
      `INSERT INTO escrows (id,order_id,payment_id,status,amount) VALUES ($1,$2,$3,'PENDING',99999999000000.00)`,
      [ids.escrow, ids.order, ids.payment],
    );
    await expectPostgresError('One escrow per order',
      `INSERT INTO escrows (id,order_id,payment_id,status,amount) VALUES ($1,$2,$3,'PENDING',100.00)`,
      [randomUUID(), ids.order, ids.payment], '23505');
    await client.query(
      `INSERT INTO escrow_transactions (id,escrow_id,type,amount) VALUES ($1,$2,'HOLD',99999999000000.00)`,
      [randomUUID(), ids.escrow],
    );

    await client.query(
      `INSERT INTO reviews (id,order_item_id,buyer_id,product_id,rating) VALUES ($1,$2,$3,$4,5)`,
      [randomUUID(), ids.item, ids.buyer, ids.product],
    );
    await expectPostgresError('Rating range 1–5',
      'UPDATE reviews SET rating=6 WHERE order_item_id=$1', [ids.item], '23514');
    await expectPostgresError('One review per purchased order item',
      `INSERT INTO reviews (id,order_item_id,buyer_id,product_id,rating) VALUES ($1,$2,$3,$4,5)`,
      [randomUUID(), ids.item, ids.buyer, ids.product], '23505');
    await client.query(
      `INSERT INTO idempotency_records (id,user_id,operation,key_hash,response)
       VALUES ($1,$2,'CHECKOUT',$3,'{}'::jsonb)`,
      [randomUUID(), ids.buyer, 'a'.repeat(64)],
    );
    await expectPostgresError('Financial idempotency key unique per user and operation',
      `INSERT INTO idempotency_records (id,user_id,operation,key_hash,response)
       VALUES ($1,$2,'CHECKOUT',$3,'{}'::jsonb)`,
      [randomUUID(), ids.buyer, 'a'.repeat(64)], '23505');
    // This ROLLBACK must erase every order, payment, escrow and ledger item above.
  } finally {
    await client.query('ROLLBACK');
  }
  for (const [table, id] of [
    ['orders', ids.order], ['payments', ids.payment], ['escrows', ids.escrow],
    ['order_items', ids.item],
  ] as const) {
    const result = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM "${table}" WHERE id=$1`, [id]);
    check(result.rows[0].count === '0', `${table} financial transaction must roll back completely`);
  }
  const retained = await client.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM inventory WHERE product_id=$1 AND available_quantity=1 AND reserved_quantity=0',
    [ids.product],
  );
  check(retained.rows[0].count === '1', 'Rolled-back writes must not change original inventory');
}

async function verifyConcurrentReservation(): Promise<void> {
  const first = new Client({ connectionString, statement_timeout: 10_000 });
  const second = new Client({ connectionString, statement_timeout: 10_000 });
  try {
    await first.connect();
    await second.connect();
    await first.query('BEGIN');
    await second.query('BEGIN');
    const statement = `UPDATE inventory SET available_quantity = available_quantity - 1,
      reserved_quantity = reserved_quantity + 1 WHERE product_id = $1 AND available_quantity >= 1
      RETURNING available_quantity, reserved_quantity`;
    const firstResult = await first.query(statement, [ids.product]);
    // Run the competing update while the first connection still holds the row lock.
    const secondPending = second.query(statement, [ids.product]);
    await first.query('COMMIT');
    const secondResult = await secondPending;
    await second.query('COMMIT');
    check(firstResult.rowCount === 1, 'First guarded atomic stock reservation should succeed');
    check(secondResult.rowCount === 0, 'Competing reservation must not oversell the final stock item');
    const inventory = await client.query<{ available_quantity: number; reserved_quantity: number }>(
      'SELECT available_quantity, reserved_quantity FROM inventory WHERE product_id=$1', [ids.product],
    );
    check(inventory.rows[0].available_quantity === 0 && inventory.rows[0].reserved_quantity === 1,
      'Concurrent reservation result must preserve quantity invariants');
  } finally {
    await first.query('ROLLBACK').catch(() => undefined);
    await second.query('ROLLBACK').catch(() => undefined);
    await first.end().catch(() => undefined);
    await second.end().catch(() => undefined);
  }
}

async function cleanup(): Promise<void> {
  // Only rows tagged with this run's randomized UUIDs; never TRUNCATE or DROP.
  await client.query('DELETE FROM products WHERE id=$1', [ids.product]);
  await client.query('DELETE FROM categories WHERE id=$1', [ids.category]);
  await client.query('DELETE FROM users WHERE id IN ($1,$2)', [ids.buyer, ids.seller]);
}

let prepared = false;
try {
  await client.connect();
  await inspectSchema();
  await makeFixtures();
  prepared = true;
  await validateIntegrity();
  await verifyConcurrentReservation();
  console.log(`DATABASE DATABASE INTEGRITY PASSED (${assertionCount} checks, PostgreSQL 18, isolated ${databaseName}).`);
  console.log('Service-level checkout concurrency, provider settlement and production release are NOT certified by this test.');
} catch (error) {
  console.error('DATABASE DATABASE INTEGRITY FAILED:', error);
  process.exitCode = 1;
} finally {
  if (prepared) {
    try { await cleanup(); } catch (error) {
      console.error('DATABASE fixture cleanup failed. Inspect dedicated test DB only:', error);
      process.exitCode = 1;
    }
  }
  await client.end().catch(() => undefined);
}
