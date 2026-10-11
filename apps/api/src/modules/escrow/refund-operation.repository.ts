import { Injectable } from '@nestjs/common';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { DatabaseTransactionService } from '../../database/database-transaction.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { refundReconcileOnly } from './refund-policy.js';

/** Database-owned refund obligation: one irrevocable intent per escrow. */
@Injectable()
export class RefundOperationRepository {
  constructor(private readonly prisma: PrismaService, private readonly transactions: DatabaseTransactionService) {}

  async enqueue(input: {
    escrowId: string; paymentId: string; actorId: string; disputeId: string | null;
    provider: string; amount: string; currency: string; requestId: string | null;
  }, tx: DatabaseTransactionContext) {
    return tx.client.refundOperation.create({ data: { ...input, status: 'READY' } });
  }

  async findById(id: string, tx?: DatabaseTransactionContext) {
    return (tx?.client ?? this.prisma).refundOperation.findUnique({ where: { id } });
  }

  /** Atomic lease; multiple app replicas cannot dispatch the same obligation concurrently. */
  async claimDue(): Promise<{ id: string; reconcileOnly: boolean; attempts: number } | null> {
    return this.transactions.runSerializable(async (tx) => {
      const rows = await tx.client.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM refund_operations
        WHERE (status = 'READY' OR
          (status = 'IN_FLIGHT' AND lease_until < CURRENT_TIMESTAMP) OR
          (status = 'PROVIDER_PENDING' AND retry_after <= CURRENT_TIMESTAMP) OR
          (status = 'NEEDS_REVIEW' AND retry_after <= CURRENT_TIMESTAMP))
        ORDER BY created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED
      `;
      if (!rows[0]) return null;
      const row = await tx.client.refundOperation.findUniqueOrThrow({ where: { id: rows[0].id } });
      const attempts = row.attempts + 1;
      await tx.client.refundOperation.update({
        where: { id: row.id }, data: { status: 'IN_FLIGHT', attempts,
          leaseUntil: new Date(Date.now() + 2 * 60_000), retryAfter: null },
      });
      return { id: row.id, reconcileOnly: refundReconcileOnly(row.status, row.attempts), attempts };
    });
  }

  async needsReview(id: string, attempts: number, code: string) {
    await this.prisma.refundOperation.updateMany({
      where: { id, attempts, status: 'IN_FLIGHT' },
      data: { status: 'NEEDS_REVIEW', leaseUntil: null,
        // Automated reviews are strictly read-only reconciliation after first attempt;
        // they must never issue another provider POST.
        retryAfter: new Date(Date.now() + 5 * 60_000), lastError: code.slice(0,128) },
    });
  }

  async pending(id: string, attempts: number, providerRefundId: string | null) {
    await this.prisma.refundOperation.updateMany({
      where: { id, attempts, status: 'IN_FLIGHT' },
      data: { status: 'PROVIDER_PENDING', leaseUntil: null,
        retryAfter: new Date(Date.now() + 60_000), providerRefundId },
    });
  }

  async lock(id: string, tx: DatabaseTransactionContext) {
    const rows = await tx.client.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM refund_operations WHERE id = ${id}::uuid FOR UPDATE
    `;
    return rows.length === 1;
  }

  async succeeded(id: string, attempts: number, providerRefundId: string, tx: DatabaseTransactionContext) {
    const changed = await tx.client.refundOperation.updateMany({
      where: { id, attempts, status: 'IN_FLIGHT' },
      data: { status: 'SUCCEEDED', providerRefundId, leaseUntil: null, retryAfter: null, lastError: null },
    });
    if (changed.count !== 1) throw new Error('REFUND_LEASE_LOST');
  }
}
