import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseTransactionService } from '../../database/database-transaction.service.js';
import { CATALOG_MODULE_API, type CatalogModuleApi } from '../catalog/public/module-api.js';
import { PAYMENTS_MODULE_API, type PaymentsModuleApi } from '../payments/public/module-api.js';
import { checkoutSweepSeconds } from './checkout-expiration.policy.js';
import { OrdersRepository } from './orders.repository.js';

/**
 * In-process scheduled task belonging to the Orders module. No new microservice,
 * public endpoint, or cross-module Prisma mutations. Transaction + order lock
 * serialize this against payment initialization, webhook success and buyer cancel.
 *
 * A PENDING external provider payment is deliberately NOT safe to expire, even
 * if the local deadline passed. It must first be canceled or reconciled with the
 * external provider (the production gateway work is a later pass).
 */
@Injectable()
export class OrderExpirationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderExpirationService.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  private cursor: string | null = null;

  constructor(
    private readonly repository: OrdersRepository,
    private readonly transactions: DatabaseTransactionService,
    @Inject(CATALOG_MODULE_API) private readonly catalog: CatalogModuleApi,
    @Inject(PAYMENTS_MODULE_API) private readonly payments: PaymentsModuleApi,
  ) {}

  onModuleInit(): void {
    if (process.env.CHECKOUT_EXPIRY_SWEEP_ENABLED === 'false' || process.env.NODE_ENV === 'test') return;
    const interval = checkoutSweepSeconds() * 1000;
    this.timer = setInterval(() => { void this.runScheduledSweep(); }, interval);
    this.timer.unref?.();
    void this.runScheduledSweep();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async runScheduledSweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.sweepOnce();
      if (result.skippedProviderPending) {
        this.logger.warn(`${result.skippedProviderPending} expired orders still have an outstanding provider payment and require payment reconciliation.`);
      }
      if (result.expired) this.logger.log(`Expired ${result.expired} abandoned pending-payment orders.`);
    } catch (error) {
      this.logger.error(`Checkout expiration sweep failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }

  /** Public for test harnesses, not a REST operation. */
  async sweepOnce(asOf: Date = new Date(), batchSize = 50): Promise<{ expired: number; skippedProviderPending: number; examined: number }> {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 200) throw new Error('Invalid expiration batch size.');
    const ids = await this.repository.listExpiredPendingOrderIds(asOf, batchSize, this.cursor);
    if (ids.length === 0) { this.cursor = null; return { expired: 0, skippedProviderPending: 0, examined: 0 }; }
    let expired = 0;
    let skippedProviderPending = 0;
    for (const orderId of ids) {
      // Progress even if a single stale external attempt needs reconciliation.
      this.cursor = orderId;
      const result = await this.expireOne(orderId, asOf);
      if (result === 'EXPIRED') expired += 1;
      if (result === 'PROVIDER_PENDING') {
        // Provider API call is deliberately outside the SQL transaction above.
        // Only an explicitly expired unpaid provider session permits release.
        try {
          if (await this.payments.expireUnpaidExternalPayment(orderId)) {
            if (await this.expireOne(orderId, asOf) === 'EXPIRED') expired += 1;
            else skippedProviderPending += 1;
          } else skippedProviderPending += 1;
        } catch (error) {
          this.logger.warn(`Provider payment requires manual review for order ${orderId}: ${error instanceof Error ? error.message : String(error)}`);
          skippedProviderPending += 1;
        }
      }
    }
    return { expired, skippedProviderPending, examined: ids.length };
  }

  private async expireOne(orderId: string, asOf: Date): Promise<'EXPIRED' | 'SKIPPED' | 'PROVIDER_PENDING'> {
    return this.transactions.runSerializable(async (transaction) => {
      if (!await this.repository.lockById(orderId, transaction)) return 'SKIPPED';
      const order = await this.repository.findOrderDetail(orderId, transaction);
      if (!order || order.status !== 'PENDING_PAYMENT' || !order.paymentExpiresAt || order.paymentExpiresAt > asOf) {
        return 'SKIPPED';
      }
      const payment = await this.payments.orderCancellationContext(orderId, transaction);
      // A real provider may have captured funds but delivered its webhook late.
      if (payment.externalPending) return 'PROVIDER_PENDING';
      if (payment.status === 'SUCCEEDED') return 'SKIPPED';
      const changed = await this.repository.cancelPendingPaymentOrder(orderId, asOf, transaction, asOf);
      if (!changed) return 'SKIPPED';
      for (const item of order.items) {
        await this.catalog.releaseInventoryReservation(item.productId, item.quantity, transaction);
      }
      return 'EXPIRED';
    });
  }
}
