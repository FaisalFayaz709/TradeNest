import { Injectable } from '@nestjs/common';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { EscrowLifecycleStatus, HoldEscrowInput } from './public/module-api.js';

const escrowSelect = {
  id: true,
  orderId: true,
  paymentId: true,
  status: true,
  amount: true,
  heldAt: true,
  releasedAt: true,
  refundedAt: true,
  transactions: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    select: { id: true, type: true, amount: true, reference: true, createdAt: true },
  },
};

@Injectable()
export class EscrowRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.escrow.findMany({ orderBy: [{ heldAt: 'desc' }, { id: 'desc' }], skip, take: limit, select: escrowSelect }),
      this.prisma.escrow.count(),
    ]);
    return { rows, total };
  }

  async holdVerifiedPayment(input: HoldEscrowInput, transaction: DatabaseTransactionContext) {
    return transaction.client.escrow.create({
      data: {
        orderId: input.orderId,
        paymentId: input.paymentId,
        status: 'HELD',
        amount: input.amount,
        heldAt: input.heldAt,
        transactions: {
          create: {
            type: 'HOLD',
            amount: input.amount,
            reference: input.reference,
          },
        },
      },
      select: { id: true, orderId: true, paymentId: true, status: true, amount: true },
    });
  }

  async findByOrderId(orderId: string, transaction?: DatabaseTransactionContext) {
    return (transaction?.client ?? this.prisma).escrow.findUnique({ where: { orderId }, select: escrowSelect });
  }

  async findById(id: string, transaction?: DatabaseTransactionContext) {
    return (transaction?.client ?? this.prisma).escrow.findUnique({ where: { id }, select: escrowSelect });
  }

  async lockById(id: string, transaction: DatabaseTransactionContext): Promise<void> {
    await transaction.client.$queryRaw`SELECT id FROM escrows WHERE id = ${id}::uuid FOR UPDATE`;
  }

  async lockByOrderId(orderId: string, transaction: DatabaseTransactionContext): Promise<void> {
    await transaction.client.$queryRaw`SELECT id FROM escrows WHERE order_id = ${orderId}::uuid FOR UPDATE`;
  }

  async transitionByOrder(
    orderId: string,
    from: readonly EscrowLifecycleStatus[],
    to: EscrowLifecycleStatus,
    transaction: DatabaseTransactionContext,
  ): Promise<boolean> {
    const result = await transaction.client.escrow.updateMany({
      where: { orderId, status: { in: [...from] } },
      data: { status: to },
    });
    return result.count === 1;
  }

  async release(
    escrowId: string,
    releasedAt: Date,
    reference: string,
    transaction: DatabaseTransactionContext,
  ): Promise<boolean> {
    const changed = await transaction.client.escrow.updateMany({
      where: { id: escrowId, status: { in: ['BUYER_CONFIRMED', 'UNDER_REVIEW'] }, refundOperation: { is: null } },
      data: { status: 'RELEASED', releasedAt },
    });
    if (changed.count !== 1) return false;
    const current = await transaction.client.escrow.findUniqueOrThrow({ where: { id: escrowId }, select: { amount: true } });
    await transaction.client.escrowTransaction.create({
      data: { escrowId, type: 'RELEASE', amount: current.amount, reference },
    });
    return true;
  }

  async refund(
    escrowId: string,
    refundedAt: Date,
    reference: string,
    transaction: DatabaseTransactionContext,
  ): Promise<boolean> {
    const changed = await transaction.client.escrow.updateMany({
      where: { id: escrowId, status: { in: ['HELD', 'UNDER_REVIEW'] } },
      data: { status: 'REFUNDED', refundedAt },
    });
    if (changed.count !== 1) return false;
    const current = await transaction.client.escrow.findUniqueOrThrow({ where: { id: escrowId }, select: { amount: true } });
    await transaction.client.escrowTransaction.create({
      data: { escrowId, type: 'REFUND', amount: current.amount, reference },
    });
    return true;
  }
}
