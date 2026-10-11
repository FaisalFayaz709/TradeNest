import { NOTIFICATIONS_MODULE_API, type NotificationsModuleApi } from '../notifications/public/module-api.js';
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AuditService } from '../../common/audit/index.js';
import { DatabaseTransactionService } from '../../database/database-transaction.service.js';
import { DISPUTES_MODULE_API, type DisputesModuleApi } from '../disputes/public/module-api.js';
import { ORDERS_MODULE_API, type OrdersModuleApi } from '../orders/public/module-api.js';
import { PAYMENTS_MODULE_API, type PaymentsModuleApi } from '../payments/public/module-api.js';
import { EscrowRepository } from './escrow.repository.js';
import { RefundOperationRepository } from './refund-operation.repository.js';
import { refundMayFinalize } from './refund-policy.js';

/** Outbox dispatcher and reconciler within the NestJS monolith.
 * No provider network call may run from inside a PostgreSQL transaction.
 * Ambiguous responses fail closed to NEEDS_REVIEW, not a second blind refund.
 */
@Injectable()
export class RefundReconciliationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RefundReconciliationService.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  constructor(
    private readonly refunds: RefundOperationRepository,
    private readonly escrow: EscrowRepository,
    private readonly transactions: DatabaseTransactionService,
    private readonly audit: AuditService,
    @Inject(PAYMENTS_MODULE_API) private readonly payments: PaymentsModuleApi,
    @Inject(ORDERS_MODULE_API) private readonly orders: OrdersModuleApi,
    @Inject(NOTIFICATIONS_MODULE_API) private readonly notifications: NotificationsModuleApi,
    @Inject(DISPUTES_MODULE_API) private readonly disputes: DisputesModuleApi,
  ) {}

  onModuleInit() {
    if (process.env.REFUND_RECONCILIATION_ENABLED === 'false' || process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => { void this.scheduled(); }, 15_000);
    this.timer.unref?.();
    void this.scheduled();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  private async scheduled() {
    if (this.running) return;
    this.running = true;
    try { await this.sweepOnce(20); }
    catch (error) { this.logger.error(`Refund reconciliation error: ${error instanceof Error ? error.message : String(error)}`); }
    finally { this.running = false; }
  }

  /** For explicit integration tests and startup worker; not a public REST endpoint. */
  async sweepOnce(limit = 20): Promise<number> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid refund sweep limit');
    let processed = 0;
    for (let i=0; i<limit; i++) {
      const claim = await this.refunds.claimDue();
      if (!claim) break;
      const row = await this.refunds.findById(claim.id);
      if (!row) throw new Error('CLAIMED_REFUND_NOT_FOUND');
      try {
        // Provider calls happen OUTSIDE any SQL transaction. Immutable refund id
        // acts as the gateway idempotency key on every attempt.
        const result = await this.payments.refundSucceededPayment({
          paymentId: row.paymentId, amount: row.amount.toString(),
          idempotencyKey: `tradenest-refund-${row.id}`,
          reconcileOnly: claim.reconcileOnly,
        });
        if (result.provider !== row.provider) throw new Error('REFUND_PROVIDER_MISMATCH');
        if (result.status === 'PENDING') {
          await this.refunds.pending(row.id, claim.attempts, result.providerRefundId);
        } else if (result.status === 'SUCCEEDED' && result.providerRefundId) {
          await this.finalize(row.id, claim.attempts, result.providerRefundId);
        } else {
          await this.refunds.needsReview(row.id, claim.attempts, 'PROVIDER_OUTCOME_UNCONFIRMED');
        }
      } catch (error) {
        // Could have reached the provider; never create a second refund blindly.
        await this.refunds.needsReview(row.id, claim.attempts, 'PROVIDER_OR_FINALIZATION_UNCERTAIN');
        this.logger.warn(`Refund operation ${row.id} requires reconciliation: ${error instanceof Error ? error.message : String(error)}`);
      }
      processed++;
    }
    return processed;
  }

  private async finalize(id: string, attempts: number, providerRefundId: string): Promise<void> {
    await this.transactions.runSerializable(async (tx) => {
      await this.refunds.lock(id, tx);
      const operation = await this.refunds.findById(id, tx);
      if (!operation || operation.status !== 'IN_FLIGHT' || operation.attempts !== attempts) throw new Error('REFUND_LEASE_LOST');
      await this.escrow.lockById(operation.escrowId, tx);
      const before = await this.escrow.findById(operation.escrowId, tx);
      if (!before || !refundMayFinalize(before.status, operation.status)) throw new Error('REFUND_ESCROW_INVALID_STATE');
      if (!await this.escrow.refund(before.id, new Date(), `${operation.provider}:refund:${providerRefundId}`.slice(0,255), tx)) {
        throw new Error('REFUND_ESCROW_COMPARE_AND_UPDATE_FAILED');
      }
      await this.orders.markRefundedFromEscrowRefund(before.orderId, tx);
      if (operation.disputeId) await this.disputes.completeRefundAfterProvider(operation.disputeId, operation.actorId, tx);
      await this.refunds.succeeded(id, attempts, providerRefundId, tx);
      const recipientOrder = await this.orders.paymentContext(before.orderId, tx);
      if (!recipientOrder) throw new Error('REFUNDED_ORDER_NOT_FOUND');
      await this.notifications.record({ key: `REFUND_COMPLETED:${id}`, type: 'REFUND_COMPLETED',
        title: 'Refund confirmed', body: 'The payment provider confirmed your refund; the order and escrow were updated.',
        recipients: [recipientOrder.buyerId],
      }, tx);
      await this.audit.write({
        actorId: operation.actorId, action: 'ESCROW_REFUND', entityType: 'escrow', entityId: before.id,
        before: { status: before.status }, after: { status: 'REFUNDED' },
        metadata: { orderId: before.orderId, paymentId: before.paymentId, provider: operation.provider, providerRefundId },
        requestId: operation.requestId,
      }, tx);
    });
  }
}
