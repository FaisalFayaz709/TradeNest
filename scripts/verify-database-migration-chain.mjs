/**
 * Database dependency-free, non-mutating migration baseline verification.
 * Protects all migrations already shipped with Foundation. Append new migrations;
 * never edit an applied historical migration or update this manifest silently.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (name) => readFileSync(resolve(root, name), 'utf8');
const manifest = JSON.parse(read('scripts/migration-baseline-sha256.json'));
const base = resolve(root, 'apps/api/prisma/migrations');
const migrationDirs = readdirSync(base, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
const failures = [];
for (const [name, hash] of Object.entries(manifest)) {
  if (!migrationDirs.includes(name)) {
    failures.push(`Locked historical migration was removed: ${name}`);
    continue;
  }
  const actual = createHash('sha256').update(read(`apps/api/prisma/migrations/${name}/migration.sql`)).digest('hex');
  if (actual !== hash) failures.push(`Locked historical migration was modified: ${name}`);
}
const baselineSql = migrationDirs.map((name) => read(`apps/api/prisma/migrations/${name}/migration.sql`)).join('\n');
const schema = read('apps/api/prisma/schema.prisma');
const models = [...schema.matchAll(/model\s+\w+\s*\{([\s\S]*?)\}/g)];
const tableNames = models.map((match) => match[1].match(/@@map\("([^\"]+)"\)/)?.[1]).filter(Boolean);
const sqlTableNames = new Set([...baselineSql.matchAll(/CREATE\s+TABLE\s+"([^"]+)"/gi)].map((m) => m[1]));
for (const name of tableNames) if (!sqlTableNames.has(name)) failures.push(`Prisma model table not created by migration chain: ${name}`);
for (const name of sqlTableNames) if (!tableNames.includes(name)) failures.push(`Migration table without Prisma model: ${name}`);
if (new Set(tableNames).size !== tableNames.length) failures.push('Duplicate Prisma model table mappings');
for (const constraint of [
  'products_price_nonnegative_check', 'inventory_available_nonnegative_check',
  'inventory_reserved_nonnegative_check', 'cart_items_quantity_positive_check',
  'order_items_quantity_positive_check', 'payments_amount_positive_check',
  'seller_profiles_rating_range_check', 'reviews_rating_range_check',
  'idempotency_records_user_operation_key_key', 'reviews_order_item_id_key',
  'escrows_order_id_key', 'disputes_order_id_key', 'carts_one_active_per_user_key',
]) {
  if (!baselineSql.includes(`"${constraint}"`)) failures.push(`Required DB constraint/index missing from migrations: ${constraint}`);
}
if (!schema.includes('@db.Decimal(30, 2)')) failures.push('Wide financial decimal precision not present in Prisma schema');
if (failures.length) {
  console.error('DATABASE STATIC MIGRATION VERIFICATION FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`DATABASE STATIC MIGRATION VERIFICATION PASSED (${Object.keys(manifest).length} baseline migrations SHA-256 verified, ${tableNames.length} model/table mappings checked).`);
  console.log('Static verification is NOT a substitute for PostgreSQL 18 migration execution.');
}
