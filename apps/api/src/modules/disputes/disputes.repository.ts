import { Injectable } from '@nestjs/common';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { PrismaService } from '../../database/prisma.service.js';

const disputeSelect = {
  id: true,
  orderId: true,
  buyerId: true,
  sellerId: true,
  reason: true,
  description: true,
  status: true,
  resolution: true,
  resolvedBy: true,
  openedAt: true,
  resolvedAt: true,
  updatedAt: true,
  messages: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    select: { id: true, disputeId: true, authorId: true, body: true, createdAt: true },
  },
  evidence: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    select: {
      id: true,
      disputeId: true,
      uploadedById: true,
      objectKey: true,
      url: true,
      fileName: true,
      mimeType: true,
      createdAt: true,
    },
  },
};

@Injectable()
export class DisputesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hasOpenForOrder(orderId: string, transaction?: DatabaseTransactionContext): Promise<boolean> {
    const count = await (transaction?.client ?? this.prisma).dispute.count({
      where: { orderId, status: 'OPEN' },
    });
    return count > 0;
  }

  findById(id: string, transaction?: DatabaseTransactionContext) {
    return (transaction?.client ?? this.prisma).dispute.findUnique({ where: { id }, select: disputeSelect });
  }

  findByOrderId(orderId: string, transaction?: DatabaseTransactionContext) {
    return (transaction?.client ?? this.prisma).dispute.findUnique({ where: { orderId }, select: disputeSelect });
  }

  async listAll(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [rows, total, open] = await this.prisma.$transaction([
      this.prisma.dispute.findMany({ orderBy: [{ openedAt: 'desc' }, { id: 'desc' }], skip, take: limit, select: disputeSelect }),
      this.prisma.dispute.count(),
      this.prisma.dispute.count({ where: { status: 'OPEN' } }),
    ]);
    return { rows, total, open };
  }

  listForSeller(sellerId: string) {
    return this.prisma.dispute.findMany({
      where: { sellerId },
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: disputeSelect,
    });
  }

  async lockById(id: string, transaction: DatabaseTransactionContext): Promise<boolean> {
    const rows = await transaction.client.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM disputes WHERE id = ${id}::uuid FOR UPDATE
    `;
    return rows.length === 1;
  }

  createOpen(
    input: { orderId: string; buyerId: string; sellerId: string; reason: string; description: string },
    transaction: DatabaseTransactionContext,
  ) {
    return transaction.client.dispute.create({
      data: { ...input, status: 'OPEN' },
      select: disputeSelect,
    });
  }

  addMessage(disputeId: string, authorId: string, body: string, transaction: DatabaseTransactionContext) {
    return transaction.client.disputeMessage.create({
      data: { disputeId, authorId, body },
      select: { id: true, disputeId: true, authorId: true, body: true, createdAt: true },
    });
  }

  addEvidence(
    disputeId: string,
    uploadedById: string,
    input: { objectKey: string; url: string; fileName?: string; mimeType?: string },
    transaction: DatabaseTransactionContext,
  ) {
    return transaction.client.disputeEvidence.create({
      data: {
        disputeId,
        uploadedById,
        objectKey: input.objectKey,
        url: input.url,
        fileName: input.fileName ?? null,
        mimeType: input.mimeType ?? null,
      },
      select: {
        id: true,
        disputeId: true,
        uploadedById: true,
        objectKey: true,
        url: true,
        fileName: true,
        mimeType: true,
        createdAt: true,
      },
    });
  }

  async resolve(
    id: string,
    resolution: 'REFUND_BUYER' | 'RELEASE_TO_SELLER',
    resolvedBy: string,
    resolvedAt: Date,
    transaction: DatabaseTransactionContext,
  ): Promise<boolean> {
    const result = await transaction.client.dispute.updateMany({
      where: { id, status: 'OPEN' },
      data: { status: 'RESOLVED', resolution, resolvedBy, resolvedAt },
    });
    return result.count === 1;
  }
}
