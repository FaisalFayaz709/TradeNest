import { Inject, Injectable, forwardRef } from '@nestjs/common';
import type { Escrow } from '@tradenest/contracts/escrow';
import { EscrowSchema } from '@tradenest/contracts/escrow';
import { AuditService } from '../../common/audit/index.js';
import { ApiException } from '../../common/http/api-exception.js';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { EscrowRepository } from './escrow.repository.js';
import { RefundOperationRepository } from './refund-operation.repository.js';
import { PAYMENTS_MODULE_API, type PaymentsModuleApi } from '../payments/public/module-api.js';
import type {
  BuyerConfirmationReleaseInput,
  EscrowModuleApi,
  EscrowShippingContext,
  HeldEscrow,
  HoldEscrowInput,
  ResolveDisputeFinancialInput,
} from './public/module-api.js';

@Injectable()
export class EscrowService implements EscrowModuleApi {
  constructor(
    private readonly repository: EscrowRepository,
    private readonly audit: AuditService,
    @Inject(forwardRef(() => PAYMENTS_MODULE_API)) private readonly payments: PaymentsModuleApi,
    private readonly refunds: RefundOperationRepository,
  ) {}

  async adminListEscrows(page: number, limit: number): Promise<{ rows: Escrow[]; total: number }> {
    const result = await this.repository.list(page, limit);
    return { rows: result.rows.map((row) => this.toEscrow(row)), total: result.total };
  }

  async shippingContext(orderId: string, transaction?: DatabaseTransactionContext): Promise<EscrowShippingContext | null> {
    const row = await this.repository.findByOrderId(orderId, transaction);
    return row ? { id: row.id, orderId: row.orderId, status: row.status } : null;
  }

  async holdVerifiedPayment(input: HoldEscrowInput, transaction: DatabaseTransactionContext): Promise<HeldEscrow> {
    const row = await this.repository.holdVerifiedPayment(input, transaction);
    return {
      id: row.id,
      orderId: row.orderId,
      paymentId: row.paymentId,
      status: 'HELD',
      amount: row.amount.toString(),
    };
  }

  async markSellerShipped(orderId: string, transaction: DatabaseTransactionContext): Promise<void> {
    await this.transitionOrThrow(orderId, ['HELD'], 'SELLER_SHIPPED', transaction);
  }

  async markBuyerConfirmed(orderId: string, transaction: DatabaseTransactionContext): Promise<void> {
    await this.transitionOrThrow(orderId, ['SELLER_SHIPPED'], 'BUYER_CONFIRMED', transaction);
  }

  async confirmBuyerAndRelease(
    input: BuyerConfirmationReleaseInput,
    transaction: DatabaseTransactionContext,
  ): Promise<void> {
    await this.repository.lockByOrderId(input.orderId, transaction);
    const before = await this.repository.findByOrderId(input.orderId, transaction);
    if (!before) {
      throw new ApiException(409, {
        code: 'INVALID_STATE_TRANSITION',
        message: 'Delivery cannot be confirmed because escrow does not exist.',
        details: { orderId: input.orderId, currentEscrowStatus: null, requestedEscrowStatus: 'RELEASED' },
      });
    }
    if (before.status !== 'SELLER_SHIPPED') {
      throw new ApiException(409, {
        code: 'INVALID_STATE_TRANSITION',
        message: 'Escrow cannot be released by buyer confirmation from its current state.',
        details: { orderId: input.orderId, currentEscrowStatus: before.status, requestedEscrowStatus: 'RELEASED' },
      });
    }

    await this.transitionOrThrow(input.orderId, ['SELLER_SHIPPED'], 'BUYER_CONFIRMED', transaction);
    if (!await this.repository.release(before.id, input.releasedAt, input.reference, transaction)) {
      const current = await this.repository.findById(before.id, transaction);
      throw new ApiException(409, {
        code: 'INVALID_STATE_TRANSITION',
        message: 'Escrow could not be released after buyer confirmation.',
        details: { orderId: input.orderId, currentEscrowStatus: current?.status ?? null, requestedEscrowStatus: 'RELEASED' },
      });
    }

    const after = await this.repository.findById(before.id, transaction);
    await this.audit.write({
      actorId: input.buyerId,
      action: 'ESCROW_RELEASE',
      entityType: 'escrow',
      entityId: before.id,
      before: {
        status: before.status,
        orderId: before.orderId,
        paymentId: before.paymentId,
        amount: before.amount.toString(),
      },
      after: after ? {
        status: after.status,
        orderId: after.orderId,
        paymentId: after.paymentId,
        amount: after.amount.toString(),
        releasedAt: after.releasedAt?.toISOString() ?? null,
      } : { status: 'RELEASED' },
      metadata: { orderId: input.orderId, paymentId: before.paymentId, cause: 'BUYER_CONFIRM_DELIVERY' },
      requestId: input.requestId ?? null,
    }, transaction);
  }

  async markDisputed(orderId: string, transaction: DatabaseTransactionContext): Promise<void> {
    await this.transitionOrThrow(orderId, ['HELD', 'SELLER_SHIPPED'], 'DISPUTED', transaction);
  }

  async markUnderReview(orderId: string, transaction: DatabaseTransactionContext): Promise<void> {
    await this.transitionOrThrow(orderId, ['DISPUTED'], 'UNDER_REVIEW', transaction);
  }


  async resolveDisputeRelease(
    input: ResolveDisputeFinancialInput,
    transaction: DatabaseTransactionContext,
  ): Promise<void> {
    await this.repository.lockByOrderId(input.orderId, transaction);
    const before = await this.repository.findByOrderId(input.orderId, transaction);
    if (!before || before.status !== 'UNDER_REVIEW') {
      throw new ApiException(409, {
        code: 'INVALID_STATE_TRANSITION',
        message: 'Disputed escrow is not ready for seller release.',
        details: { orderId: input.orderId, currentStatus: before?.status ?? null, requestedStatus: 'RELEASED' },
      });
    }
    const now = new Date();
    const reference = `dispute-release:${input.actorId}:${before.id}`.slice(0, 255);
    if (!await this.repository.release(before.id, now, reference, transaction)) {
      throw new ApiException(409, {
        code: 'INVALID_STATE_TRANSITION',
        message: 'Disputed escrow could not be released.',
        details: { orderId: input.orderId, currentStatus: before.status, requestedStatus: 'RELEASED' },
      });
    }
    const after = await this.repository.findById(before.id, transaction);
    await this.audit.write({
      actorId: input.actorId,
      action: 'ESCROW_RELEASE',
      entityType: 'escrow',
      entityId: before.id,
      before: { status: before.status, amount: before.amount.toString() },
      after: after ? { status: after.status, amount: after.amount.toString(), releasedAt: after.releasedAt?.toISOString() ?? null } : { status: 'RELEASED' },
      metadata: { orderId: before.orderId, paymentId: before.paymentId, cause: 'DISPUTE_RESOLUTION' },
      requestId: input.requestId ?? null,
    }, transaction);
  }

  async resolveDisputeRefund(
    input: ResolveDisputeFinancialInput,
    transaction: DatabaseTransactionContext,
  ): Promise<void> {
    await this.repository.lockByOrderId(input.orderId, transaction);
    const before = await this.repository.findByOrderId(input.orderId, transaction);
    if (!before || before.status !== 'UNDER_REVIEW') {
      throw new ApiException(409, {
        code: 'INVALID_STATE_TRANSITION',
        message: 'Disputed escrow is not ready for buyer refund.',
        details: { orderId: input.orderId, currentStatus: before?.status ?? null, requestedStatus: 'REFUNDED' },
      });
    }
    // Durable intent only. The dispute remains OPEN/UNDER_REVIEW until
    // the provider confirms the actual refund. No network I/O in this transaction.
    const payment = await this.payments.refundContext(before.paymentId, this.money(before.amount.toString()), transaction);
    await this.refunds.enqueue({
      provider: payment.provider, currency: payment.currency,
      escrowId: before.id, paymentId: before.paymentId, actorId: input.actorId,
      disputeId: input.disputeId ?? null, amount: this.money(before.amount.toString()),
      requestId: input.requestId ?? null,
    }, transaction);
  }

  private toEscrow(row: any): Escrow {
    return EscrowSchema.parse({
      id: row.id, orderId: row.orderId, paymentId: row.paymentId, status: row.status, amount: this.money(row.amount.toString()),
      heldAt: row.heldAt?.toISOString() ?? null, releasedAt: row.releasedAt?.toISOString() ?? null, refundedAt: row.refundedAt?.toISOString() ?? null,
      transactions: row.transactions.map((item: any) => ({ ...item, amount: this.money(item.amount.toString()), createdAt: item.createdAt.toISOString() })),
    });
  }

  private money(value: string): string {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
    if (!match) throw new Error(`Invalid authoritative money value: ${value}`);
    return `${match[1]}.${(match[2] ?? '').padEnd(2, '0')}`;
  }

  private async transitionOrThrow(
    orderId: string,
    from: Parameters<EscrowRepository['transitionByOrder']>[1],
    to: Parameters<EscrowRepository['transitionByOrder']>[2],
    transaction: DatabaseTransactionContext,
  ): Promise<void> {
    const changed = await this.repository.transitionByOrder(orderId, from, to, transaction);
    if (changed) return;
    const current = await this.repository.findByOrderId(orderId, transaction);
    if (current?.status === to) return;
    throw new ApiException(409, {
      code: 'INVALID_STATE_TRANSITION',
      message: 'The escrow cannot transition from its current state.',
      details: { orderId, currentStatus: current?.status ?? null, requestedStatus: to },
    });
  }
}
