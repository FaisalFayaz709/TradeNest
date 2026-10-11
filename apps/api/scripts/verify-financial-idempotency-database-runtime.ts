import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../src/database/prisma.service.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const prisma = new PrismaService();
const userId = randomUUID();
const keyHash = '1'.repeat(64);
const requestHash = '2'.repeat(64);

try {
  const columns = await prisma.$queryRaw<Array<{ column_name: string; is_nullable: string }>>`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'idempotency_records'
      AND column_name IN ('request_hash', 'response')
    ORDER BY column_name
  `;
  const byName = new Map(columns.map((row) => [row.column_name, row.is_nullable]));
  assert(byName.get('request_hash') === 'YES', 'request_hash must exist and remain nullable for legacy compatibility.');
  assert(byName.get('response') === 'YES', 'response must be nullable while an uncommitted claim is in progress.');

  await prisma.user.create({
    data: {
      id: userId,
      email: `financial-${userId}@example.invalid`,
      passwordHash: 'not-a-real-login-hash',
      name: 'the implementation Runtime User',
      role: 'BUYER',
      status: 'ACTIVE',
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.idempotencyRecord.create({
      data: {
        userId,
        operation: 'financial_RUNTIME',
        keyHash,
        requestHash,
        response: Prisma.DbNull,
      },
    });
    const claim = await tx.idempotencyRecord.findUniqueOrThrow({
      where: { userId_operation_keyHash: { userId, operation: 'financial_RUNTIME', keyHash } },
    });
    assert(claim.requestHash === requestHash, 'Claim must persist the request fingerprint before completion.');
    await tx.idempotencyRecord.update({
      where: { userId_operation_keyHash: { userId, operation: 'financial_RUNTIME', keyHash } },
      data: { response: { ok: true } },
    });
  });

  const completed = await prisma.idempotencyRecord.findUniqueOrThrow({
    where: { userId_operation_keyHash: { userId, operation: 'financial_RUNTIME', keyHash } },
  });
  assert(completed.response !== null, 'Claim must be completed with the original response before commit.');

  let duplicateRejected = false;
  try {
    await prisma.idempotencyRecord.create({
      data: { userId, operation: 'financial_RUNTIME', keyHash, requestHash, response: { duplicate: true } },
    });
  } catch (error) {
    duplicateRejected = typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';
  }
  assert(duplicateRejected, 'The database must reject a duplicate user+operation+key claim.');

  console.log('the implementation FINANCIAL IDEMPOTENCY DATABASE VERIFICATION PASSED');
} finally {
  await prisma.idempotencyRecord.deleteMany({ where: { userId } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
  await prisma.$disconnect();
}
