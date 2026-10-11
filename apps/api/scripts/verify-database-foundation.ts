import 'dotenv/config';
import { Client } from 'pg';
import { parseApiEnvironment } from '@tradenest/config';

const expectedTables = [
  'users',
  'user_sessions',
  'seller_profiles',
  'addresses',
  'categories',
  'products',
  'product_images',
  'inventory',
  'carts',
  'cart_items',
  'orders',
  'order_items',
  'payments',
  'escrows',
  'escrow_transactions',
  'shipments',
  'disputes',
  'dispute_messages',
  'dispute_evidence',
  'wishlist_items',
  'reviews',
  'user_events',
  'ai_recommendations',
  'fraud_assessments',
  'notifications',
  'audit_logs',
  'idempotency_records',
] as const;

const expectedChecks = [
  'products_price_nonnegative_check',
  'inventory_available_nonnegative_check',
  'inventory_reserved_nonnegative_check',
  'cart_items_quantity_positive_check',
  'order_items_quantity_positive_check',
  'payments_amount_positive_check',
  'seller_profiles_rating_range_check',
  'reviews_rating_range_check',
] as const;

const expectedIndexes = [
  'users_email_key',
  'products_slug_key',
  'cart_items_cart_product_key',
  'payments_provider_payment_id_key',
  'escrows_order_id_key',
  'disputes_order_id_key',
  'reviews_order_item_id_key',
  'carts_one_active_per_user_key',
  'products_seller_status_idx',
  'products_category_status_idx',
  'orders_buyer_status_created_idx',
  'escrows_order_status_idx',
  'disputes_status_idx',
  'user_events_user_type_time_idx',
  'user_events_product_type_time_idx',
  'idempotency_records_user_operation_key_key',
  'idempotency_records_user_created_idx',
] as const;

const environment = parseApiEnvironment(process.env);
const client = new Client({ connectionString: environment.DATABASE_URL });

async function main(): Promise<void> {
  await client.connect();

  const tables = await client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  const tableSet = new Set(tables.rows.map((row) => row.table_name));

  const checks = await client.query<{ constraint_name: string }>(`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_type = 'CHECK'
  `);
  const checkSet = new Set(checks.rows.map((row) => row.constraint_name));

  const indexes = await client.query<{ indexname: string }>(`
    SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
  `);
  const indexSet = new Set(indexes.rows.map((row) => row.indexname));

  const missingTables = expectedTables.filter((name) => !tableSet.has(name));
  const missingChecks = expectedChecks.filter((name) => !checkSet.has(name));
  const missingIndexes = expectedIndexes.filter((name) => !indexSet.has(name));

  if (missingTables.length || missingChecks.length || missingIndexes.length) {
    console.error('DATABASE FOUNDATION VERIFICATION FAILED');
    if (missingTables.length) console.error(`Missing tables: ${missingTables.join(', ')}`);
    if (missingChecks.length) console.error(`Missing CHECK constraints: ${missingChecks.join(', ')}`);
    if (missingIndexes.length) console.error(`Missing indexes: ${missingIndexes.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  console.log('DATABASE FOUNDATION VERIFICATION PASSED');
  console.log(`${expectedTables.length} TradeNest tables found with locked integrity constraints and key indexes.`);
}

main()
  .catch((error: unknown) => {
    console.error('DATABASE FOUNDATION VERIFICATION FAILED');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => undefined);
  });
