import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main(): Promise<void> {
  const buyerId = randomUUID();
  const adminId = randomUUID();
  const orderId = randomUUID();
  const paymentId = randomUUID();
  const escrowId = randomUUID();
  try {
    await prisma.user.createMany({ data: [
      { id: buyerId, email: `${buyerId}@example.invalid`, passwordHash: 'x', name: 'Buyer', role: 'BUYER', status: 'ACTIVE' },
      { id: adminId, email: `${adminId}@example.invalid`, passwordHash: 'x', name: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
    ] });
    await prisma.order.create({ data: {
      id: orderId, orderNumber: `P17-${orderId.slice(0, 8)}`, buyerId, status: 'DELIVERED', currency: 'USD',
      subtotal: '19.95', shippingAmount: '0.00', discountAmount: '0.00', totalAmount: '19.95', shippingAddress: { test: true },
    } });
    await prisma.payment.create({ data: {
      id: paymentId, orderId, buyerId, provider: 'sandbox', providerPaymentId: `sandbox_${paymentId}`,
      status: 'SUCCEEDED', amount: '19.95', currency: 'USD', paidAt: new Date(),
    } });
    await prisma.escrow.create({ data: {
      id: escrowId, orderId, paymentId, status: 'BUYER_CONFIRMED', amount: '19.95', heldAt: new Date(),
      transactions: { create: { type: 'HOLD', amount: '19.95', reference: 'escrow-fixture' } },
    } });

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM escrows WHERE id = ${escrowId}::uuid FOR UPDATE`;
      const changed = await tx.escrow.updateMany({ where: { id: escrowId, status: 'BUYER_CONFIRMED' }, data: { status: 'RELEASED', releasedAt: new Date() } });
      if (changed.count !== 1) throw new Error('Escrow release compare-and-update failed.');
      await tx.escrowTransaction.create({ data: { escrowId, type: 'RELEASE', amount: '19.95', reference: 'escrow-release' } });
      const order = await tx.order.updateMany({ where: { id: orderId, status: 'DELIVERED' }, data: { status: 'COMPLETED', completedAt: new Date() } });
      if (order.count !== 1) throw new Error('Order completion compare-and-update failed.');
      await tx.auditLog.create({ data: { actorId: adminId, action: 'ESCROW_RELEASE', entityType: 'escrow', entityId: escrowId } });
    }, { isolationLevel: 'Serializable' });

    const escrow = await prisma.escrow.findUniqueOrThrow({ where: { id: escrowId }, include: { transactions: true } });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const audits = await prisma.auditLog.count({ where: { entityId: escrowId, action: 'ESCROW_RELEASE' } });
    if (escrow.status !== 'RELEASED' || order.status !== 'COMPLETED') throw new Error('Release state did not commit atomically.');
    if (escrow.transactions.filter((entry) => entry.type === 'RELEASE').length !== 1) throw new Error('Expected exactly one RELEASE ledger entry.');
    if (audits !== 1) throw new Error('Expected one release audit record.');

    console.log('the implementation ESCROW DATABASE VERIFICATION PASSED');
  } finally {
    await prisma.auditLog.deleteMany({ where: { entityId: escrowId } }).catch(() => undefined);
    await prisma.escrowTransaction.deleteMany({ where: { escrowId } }).catch(() => undefined);
    await prisma.escrow.deleteMany({ where: { id: escrowId } }).catch(() => undefined);
    await prisma.payment.deleteMany({ where: { id: paymentId } }).catch(() => undefined);
    await prisma.order.deleteMany({ where: { id: orderId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: [buyerId, adminId] } } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

await main();
