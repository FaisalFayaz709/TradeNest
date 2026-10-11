import { ChangePasswordSchema, LoginSchema } from '@tradenest/contracts/auth';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function verifyPasswordBoundary(): void {
  const email = 'integrity@example.com';
  assert(LoginSchema.safeParse({ email, password: 'a'.repeat(72) }).success, '72-byte login password should remain valid.');
  assert(!LoginSchema.safeParse({ email, password: 'a'.repeat(73) }).success, '73-byte login password must be rejected before bcrypt compare.');
  assert(!ChangePasswordSchema.safeParse({ currentPassword: 'a'.repeat(73), newPassword: 'safe-pass' }).success, 'Overlong current password must be rejected before bcrypt compare.');
  assert(!LoginSchema.safeParse({ email, password: '💡'.repeat(19) }).success, 'UTF-8 byte length, not character count, must enforce bcrypt input limit.');
}

async function verifyDatabasePrecision(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });
  try {
    const expected = new Map<string, [number, number]>([
      ['orders.subtotal', [30, 2]],
      ['orders.shipping_amount', [30, 2]],
      ['orders.discount_amount', [30, 2]],
      ['orders.total_amount', [30, 2]],
      ['order_items.total_price', [30, 2]],
      ['payments.amount', [30, 2]],
      ['escrows.amount', [30, 2]],
      ['escrow_transactions.amount', [30, 2]],
    ]);
    const rows = await prisma.$queryRaw<Array<{ table_name: string; column_name: string; numeric_precision: number; numeric_scale: number }>>`
      SELECT table_name, column_name, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (table_name, column_name) IN (
          ('orders','subtotal'), ('orders','shipping_amount'), ('orders','discount_amount'), ('orders','total_amount'),
          ('order_items','total_price'), ('payments','amount'), ('escrows','amount'), ('escrow_transactions','amount')
        )
    `;
    assert(rows.length === expected.size, `Expected ${expected.size} widened financial columns, got ${rows.length}.`);
    for (const row of rows) {
      const key = `${row.table_name}.${row.column_name}`;
      const target = expected.get(key);
      assert(target, `Unexpected precision row ${key}.`);
      assert(Number(row.numeric_precision) === target[0] && Number(row.numeric_scale) === target[1], `${key} must be NUMERIC(${target[0]},${target[1]}).`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

verifyPasswordBoundary();
await verifyDatabasePrecision();
console.log('CONTRACT AND FINANCIAL INTEGRITY RUNTIME VERIFICATION SUCCEEDED');
