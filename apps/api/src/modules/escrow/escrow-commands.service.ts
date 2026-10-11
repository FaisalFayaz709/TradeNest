import { Inject, Injectable } from '@nestjs/common';
import { EscrowSchema, FinancialIdempotencyKeySchema, type Escrow } from '@tradenest/contracts';
import { AuthorizationService } from '../../common/authorization/index.js';
import { AuditService } from '../../common/audit/index.js';
import { ApiException } from '../../common/http/api-exception.js';
import { FinancialIdempotencyService } from '../../common/idempotency/index.js';
import { DatabaseTransactionService } from '../../database/database-transaction.service.js';
import type { AuthPrincipal } from '../auth/public/index.js';
import { ORDERS_MODULE_API, type OrdersModuleApi } from '../orders/public/module-api.js';
import { PAYMENTS_MODULE_API, type PaymentsModuleApi } from '../payments/public/module-api.js';
import { EscrowRepository } from './escrow.repository.js';
import { RefundOperationRepository } from './refund-operation.repository.js';

@Injectable()
export class EscrowCommandsService {
  constructor(
    private readonly repository: EscrowRepository,
    private readonly authorization: AuthorizationService,
    private readonly transactions: DatabaseTransactionService,
    private readonly idempotency: FinancialIdempotencyService,
    private readonly audit: AuditService,
    @Inject(ORDERS_MODULE_API) private readonly orders: OrdersModuleApi,
    @Inject(PAYMENTS_MODULE_API) private readonly payments: PaymentsModuleApi,
    private readonly refunds: RefundOperationRepository,
  ) {}

  async getForOrder(principal: AuthPrincipal, orderId: string): Promise<Escrow> {
    this.authorization.requireRole(principal, ['BUYER', 'SELLER', 'ADMIN']);
    const order = await this.orders.escrowAccessContext(orderId);
    if (!order) throw this.notFound();
    const allowed = principal.role === 'ADMIN'
      || order.buyerId === principal.userId
      || (principal.role === 'SELLER' && order.sellerIds.includes(principal.userId));
    this.authorization.requirePolicy(allowed, {
      status: 404,
      code: 'ESCROW_NOT_FOUND',
      message: 'The requested escrow was not found.',
    });
    const escrow = await this.repository.findByOrderId(orderId);
    if (!escrow) throw this.notFound();
    return this.mapEscrow(escrow);
  }

  async release(
    principal: AuthPrincipal,
    escrowId: string,
    rawIdempotencyKey: string | undefined,
    requestId?: string,
  ): Promise<Escrow> {
    this.authorization.requireRole(principal, ['ADMIN']);
    const key = this.requireIdempotencyKey(rawIdempotencyKey);
    const operation = 'ESCROW_RELEASE';
    const token = this.idempotency.prepare(key, { escrowId });
    const replay = await this.idempotency.replayOrThrow<unknown>(principal.userId, operation, token);
    if (replay) return EscrowSchema.parse(replay);

    try {
      return await this.transactions.runSerializable(async (transaction) => {
        const transactionReplay = await this.idempotency.claimOrReplay<unknown>(principal.userId, operation, token, transaction);
        if (transactionReplay) return EscrowSchema.parse(transactionReplay);

        await this.repository.lockById(escrowId, transaction);
        const before = await this.repository.findById(escrowId, transaction);
        if (!before) throw this.notFound();
        if (before.status !== 'BUYER_CONFIRMED' && before.status !== 'UNDER_REVIEW') {
          throw this.invalidTransition(before.status, 'RELEASED');
        }
        const order = await this.orders.escrowAccessContext(before.orderId, transaction);
        if (!order) throw this.notFound();
        const compatibleRelease = (before.status === 'BUYER_CONFIRMED' && order.status === 'DELIVERED')
          || (before.status === 'UNDER_REVIEW' && order.status === 'DISPUTED');
        if (!compatibleRelease) throw this.invalidCoupledState(before.status, order.status, 'RELEASED');

        const now = new Date();
        const reference = `admin-release:${principal.userId}:${escrowId}`.slice(0, 255);
        if (!await this.repository.release(escrowId, now, reference, transaction)) {
          throw this.invalidTransition(before.status, 'RELEASED');
        }
        await this.orders.markCompletedFromEscrowRelease(before.orderId, transaction);
        const after = await this.repository.findById(escrowId, transaction);
        if (!after) throw this.notFound();
        const response = this.mapEscrow(after);
        await this.audit.write({
          actorId: principal.userId,
          action: 'ESCROW_RELEASE',
          entityType: 'escrow',
          entityId: escrowId,
          before: this.auditState(before),
          after: this.auditState(after),
          metadata: { orderId: before.orderId, paymentId: before.paymentId },
          requestId: this.cleanRequestId(requestId),
        }, transaction);
        await this.idempotency.complete(principal.userId, operation, token, response, transaction);
        return response;
      });
    } catch (error) {
      if (this.hasPrismaCode(error, 'P2002')) {
        const concurrentReplay = await this.idempotency.replayOrThrow<unknown>(principal.userId, operation, token);
        if (concurrentReplay) return EscrowSchema.parse(concurrentReplay);
      }
      throw error;
    }
  }

  async refund(
    principal: AuthPrincipal,
    escrowId: string,
    rawIdempotencyKey: string | undefined,
    requestId?: string,
  ): Promise<Escrow> {
    this.authorization.requireRole(principal, ['ADMIN']);
    const key = this.requireIdempotencyKey(rawIdempotencyKey);
    const operation = 'ESCROW_REFUND';
    const token = this.idempotency.prepare(key, { escrowId });
    const replay = await this.idempotency.replayOrThrow<unknown>(principal.userId, operation, token);
    if (replay) return EscrowSchema.parse(replay);

    try {
      return await this.transactions.runSerializable(async (transaction) => {
        const transactionReplay = await this.idempotency.claimOrReplay<unknown>(principal.userId, operation, token, transaction);
        if (transactionReplay) return EscrowSchema.parse(transactionReplay);

        // Row lock prevents two different Idempotency-Keys from issuing concurrent refunds.
        await this.repository.lockById(escrowId, transaction);
        const before = await this.repository.findById(escrowId, transaction);
        if (!before) throw this.notFound();
        if (before.status !== 'HELD' && before.status !== 'UNDER_REVIEW') {
          throw this.invalidTransition(before.status, 'REFUNDED');
        }
        const order = await this.orders.escrowAccessContext(before.orderId, transaction);
        if (!order) throw this.notFound();
        const compatibleRefund = (before.status === 'HELD' && ['PAID', 'PROCESSING'].includes(order.status))
          || (before.status === 'UNDER_REVIEW' && order.status === 'DISPUTED');
        if (!compatibleRefund) throw this.invalidCoupledState(before.status, order.status, 'REFUNDED');

        const payment = await this.payments.refundContext(before.paymentId, this.money(before.amount.toString()), transaction);
        await this.refunds.enqueue({
          provider: payment.provider, currency: payment.currency,
          escrowId, paymentId: before.paymentId, actorId: principal.userId,
          disputeId: null, amount: this.money(before.amount.toString()),
          requestId: this.cleanRequestId(requestId),
        }, transaction);
        // Escrow state remains HELD / UNDER_REVIEW until external funds
        // are verified refunded; callers must poll the escrow state.
        const response = this.mapEscrow(before);
        await this.idempotency.complete(principal.userId, operation, token, response, transaction);
        return response;
      });
    } catch (error) {
      if (this.hasPrismaCode(error, 'P2002')) {
        const concurrentReplay = await this.idempotency.replayOrThrow<unknown>(principal.userId, operation, token);
        if (concurrentReplay) return EscrowSchema.parse(concurrentReplay);
      }
      throw error;
    }
  }

  private mapEscrow(row: any): Escrow {
    return EscrowSchema.parse({
      id: row.id,
      orderId: row.orderId,
      paymentId: row.paymentId,
      status: row.status,
      amount: this.money(row.amount.toString()),
      heldAt: row.heldAt?.toISOString() ?? null,
      releasedAt: row.releasedAt?.toISOString() ?? null,
      refundedAt: row.refundedAt?.toISOString() ?? null,
      transactions: row.transactions.map((entry: any) => ({
        id: entry.id,
        type: entry.type,
        amount: this.money(entry.amount.toString()),
        reference: entry.reference,
        createdAt: entry.createdAt.toISOString(),
      })),
    });
  }

  private auditState(row: any): Record<string, unknown> {
    return {
      status: row.status,
      amount: this.money(row.amount.toString()),
      heldAt: row.heldAt?.toISOString() ?? null,
      releasedAt: row.releasedAt?.toISOString() ?? null,
      refundedAt: row.refundedAt?.toISOString() ?? null,
    };
  }

  private requireIdempotencyKey(value: string | undefined): string {
    const parsed = FinancialIdempotencyKeySchema.safeParse(value);
    if (!parsed.success) {
      throw new ApiException(400, {
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'A valid Idempotency-Key header is required for escrow financial commands.',
      });
    }
    return parsed.data;
  }

  private invalidTransition(currentStatus: string, requestedStatus: string): ApiException {
    return new ApiException(409, {
      code: 'INVALID_STATE_TRANSITION',
      message: 'The escrow cannot transition from its current state.',
      details: { currentStatus, requestedStatus },
    });
  }

  private invalidCoupledState(escrowStatus: string, orderStatus: string, requestedStatus: string): ApiException {
    return new ApiException(409, {
      code: 'INVALID_STATE_TRANSITION',
      message: 'Order and escrow state are not compatible with the requested financial transition.',
      details: { escrowStatus, orderStatus, requestedStatus },
    });
  }

  private notFound(): ApiException {
    return new ApiException(404, { code: 'ESCROW_NOT_FOUND', message: 'The requested escrow was not found.' });
  }

  private cleanRequestId(value: string | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned && cleaned.length <= 128 ? cleaned : null;
  }

  private money(value: string): string {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
    if (!match) throw new Error(`Invalid authoritative money value: ${value}`);
    const minor = BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
    return `${minor / 100n}.${(minor % 100n).toString().padStart(2, '0')}`;
  }

  private hasPrismaCode(error: unknown, code: string): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === code;
  }
}
