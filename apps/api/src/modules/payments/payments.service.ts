import { NOTIFICATIONS_MODULE_API, type NotificationsModuleApi } from '../notifications/public/module-api.js';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  PaymentIdempotencyKeySchema,
  PaymentInitiationSchema,
  PaymentSchema,
  PaymentWebhookAcknowledgementSchema,
  type Payment,
  type PaymentInitiation,
  type PaymentWebhookAcknowledgement,
} from '@tradenest/contracts/payments';
import { AuthorizationService } from '../../common/authorization/index.js';
import { ApiException } from '../../common/http/api-exception.js';
import { FinancialIdempotencyService } from '../../common/idempotency/index.js';
import { RateLimitService } from '../../common/rate-limit/index.js';
import { DatabaseTransactionService, type DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { A_I_BRIDGE_MODULE_API, type AIBridgeModuleApi } from '../ai-bridge/public/module-api.js';
import type { AuthPrincipal } from '../auth/public/index.js';
import { CATALOG_MODULE_API, type CatalogModuleApi } from '../catalog/public/module-api.js';
import { ESCROW_MODULE_API, type EscrowModuleApi } from '../escrow/public/module-api.js';
import { ORDERS_MODULE_API, type OrdersModuleApi, type PaymentOrderContext } from '../orders/public/module-api.js';
import { PaymentsRepository, type PaymentRecord } from './payments.repository.js';
import { PaymentProviderRegistry } from './provider/payment-provider.registry.js';
import type { VerifiedPaymentEvent } from './provider/payment-provider.js';
import type {
  CreatePendingCheckoutPaymentInput,
  PendingCheckoutPayment,
  PaymentsModuleApi,
  ProviderRefundResult,
  OrderCancellationPaymentContext,
  RefundSucceededPaymentInput,
} from './public/module-api.js';

@Injectable()
export class PaymentsService implements PaymentsModuleApi {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly repository: PaymentsRepository,
    private readonly authorization: AuthorizationService,
    private readonly transactions: DatabaseTransactionService,
    private readonly idempotency: FinancialIdempotencyService,
    private readonly rateLimits: RateLimitService,
    private readonly providers: PaymentProviderRegistry,
    @Inject(ORDERS_MODULE_API) private readonly orders: OrdersModuleApi,
    @Inject(CATALOG_MODULE_API) private readonly catalog: CatalogModuleApi,
    @Inject(forwardRef(() => ESCROW_MODULE_API)) private readonly escrow: EscrowModuleApi,
    @Inject(NOTIFICATIONS_MODULE_API) private readonly notifications: NotificationsModuleApi,
    @Inject(A_I_BRIDGE_MODULE_API) private readonly aiBridge: AIBridgeModuleApi,
  ) {}

  async adminListPayments(page: number, limit: number) {
    const result = await this.repository.list(page, limit);
    return { rows: result.rows.map((row) => PaymentSchema.parse(this.map(row))), total: result.total };
  }

  async createPendingCheckoutPayment(
    input: CreatePendingCheckoutPaymentInput,
    transaction: DatabaseTransactionContext,
  ): Promise<PendingCheckoutPayment> {
    const row = await this.repository.createPendingCheckoutPayment(input, transaction);
    return {
      id: row.id,
      orderId: row.orderId,
      status: 'PENDING',
      amount: this.money(row.amount.toString()),
      currency: row.currency,
    };
  }

  async orderCancellationContext(
    orderId: string,
    transaction: DatabaseTransactionContext,
  ): Promise<OrderCancellationPaymentContext> {
    const latest = await this.repository.findLatestForOrder(orderId, transaction);
    if (!latest) return { status: null, provider: null, externalPending: false };
    return {
      status: latest.status,
      provider: latest.provider,
      externalPending: latest.status === 'PENDING' && latest.provider !== 'INTERNAL_PENDING',
    };
  }

  /** Outside SQL transaction: expire an unpaid external checkout first, then
   * mark the internal payment FAILED only if both provider and order still agree.
   * Returns false on paid, pending/unknown, or unsupported provider outcomes.
   */
  async expireUnpaidExternalPayment(orderId: string): Promise<boolean> {
    const payment = await this.repository.findLatestForOrder(orderId);
    if (!payment || payment.status !== 'PENDING' || payment.provider === 'INTERNAL_PENDING' ||
        payment.providerPaymentId.startsWith('tradenest_init_')) return false;
    const provider = this.providers.byId(payment.provider);
    if (!provider.expireUnpaidPayment) return false;
    const expired = await provider.expireUnpaidPayment(payment.providerPaymentId, this.money(payment.amount.toString()), payment.currency);
    if (!expired) return false;
    return this.transactions.runSerializable(async (tx) => {
      const order = await this.orders.paymentContext(orderId, tx); // locks same row used by checkout sweeper/webhook
      if (!order || order.status !== 'PENDING_PAYMENT') return false;
      const current = await this.repository.findById(payment.id, tx);
      if (!current || current.status !== 'PENDING' || current.providerPaymentId !== payment.providerPaymentId) return false;
      await this.repository.markFailed(current.id, 'PROVIDER_SESSION_EXPIRED', null, tx);
      return true;
    });
  }

  async refundContext(paymentId: string, amount: string, transaction: DatabaseTransactionContext) {
    const payment = await this.repository.findById(paymentId, transaction);
    if (!payment) throw this.notFound();
    if (payment.status !== 'SUCCEEDED') throw this.invalidPaymentTransition(payment.status, 'REFUNDED');
    if (this.toMinor(payment.amount.toString()) !== this.toMinor(amount)) {
      throw new ApiException(409, { code: 'PAYMENT_REFUND_AMOUNT_MISMATCH', message: 'Refund amount differs from the authoritative payment.' });
    }
    return { provider: payment.provider, currency: payment.currency };
  }

  async refundSucceededPayment(
    input: RefundSucceededPaymentInput,
    transaction?: DatabaseTransactionContext,
  ): Promise<ProviderRefundResult> {
    if (transaction) throw new ApiException(409, {
      code: 'REFUND_REQUIRES_OUTSIDE_TRANSACTION',
      message: 'External provider requests must be dispatched after the refund intent is committed.',
    });
    const payment = await this.repository.findById(input.paymentId);
    if (!payment) throw this.notFound();
    if (payment.status !== 'SUCCEEDED') throw this.invalidPaymentTransition(payment.status, 'REFUNDED');
    if (this.toMinor(payment.amount.toString()) !== this.toMinor(input.amount)) {
      throw new ApiException(409, {
        code: 'PAYMENT_REFUND_AMOUNT_MISMATCH',
        message: 'The refund amount does not match the authoritative succeeded payment amount.',
        details: { paymentId: payment.id },
      });
    }
    const provider = this.providers.byId(payment.provider);
    return provider.refundPayment({
      paymentId: payment.id,
      providerPaymentId: payment.providerPaymentId,
      amount: this.money(payment.amount.toString()),
      currency: payment.currency,
      idempotencyKey: input.idempotencyKey,
      reconcileOnly: input.reconcileOnly ?? false,
    });
  }

  /** A durable two-stage provider initiation. Never open a PostgreSQL transaction
   * across a network call to Stripe. Both stages retain order-row serialization;
   * an unfinished claim can be retried with the SAME Idempotency-Key.
   * Different keys cannot initialize a second provider session for the order.
   */
  async initiate(principal: AuthPrincipal, orderId: string, rawIdempotencyKey: string | undefined): Promise<PaymentInitiation> {
    this.authorization.requireRole(principal, ['BUYER']);
    const idempotencyKey = this.requireIdempotencyKey(rawIdempotencyKey);
    const operation = 'PAYMENT_CREATE';
    const legacyOperation = `PAYMENT_CREATE:${orderId}`;
    const idempotency = this.idempotency.prepare(idempotencyKey, { orderId });
    const replay = await this.idempotency.replayOrPermitInProgress<unknown>(principal.userId, operation, idempotency);
    if (replay) return PaymentInitiationSchema.parse(replay);
    const legacyReplay = await this.idempotency.replayOrThrow<unknown>(principal.userId, legacyOperation, idempotency);
    if (legacyReplay) return PaymentInitiationSchema.parse(legacyReplay);

    const provider = this.providers.configured();
    // Commit the durable claim and stable payment UUID BEFORE any provider I/O.
    // A failed/ambiguous provider call leaves this durable claim for same-key retry.
    let claimed: { paymentId: string; amount: string; currency: string; startedAt: Date } | { replay: PaymentInitiation };
    try {
      claimed = await this.transactions.runSerializable(async (transaction) => {
        const old = await this.idempotency.replayOrThrow<unknown>(principal.userId, legacyOperation, idempotency, transaction);
        if (old) return { replay: PaymentInitiationSchema.parse(old) };
        const already = await this.idempotency.claimOrResume<unknown>(principal.userId, operation, idempotency, transaction);
        if (already) return { replay: PaymentInitiationSchema.parse(already) };
        // Lock the order before reading/marking the pending payment.
        const order = await this.orders.paymentContext(orderId, transaction);
        if (!order) throw new ApiException(404, { code: 'ORDER_NOT_FOUND', message: 'The requested order was not found.' });
        this.authorization.requireOwnership(principal, order.buyerId, { conceal: true, resourceCode: 'ORDER_NOT_FOUND' });
        if (order.status !== 'PENDING_PAYMENT') throw new ApiException(409, {
          code: 'ORDER_NOT_PAYABLE', message: 'The order is not eligible for payment creation.',
          details: { orderId, status: order.status },
        });
        const latest = await this.repository.findLatestForOrder(orderId, transaction);
        if (latest?.status === 'SUCCEEDED') throw this.alreadyPaid(orderId);
        const paymentId = latest?.status === 'PENDING' ? latest.id : randomUUID();
        const marker = `tradenest_init_${paymentId}`;
        if (latest?.status === 'PENDING' && latest.provider !== 'INTERNAL_PENDING' &&
            (latest.provider !== provider.id || latest.providerPaymentId !== marker)) {
          throw new ApiException(409, {
            code: 'PAYMENT_ALREADY_INITIALIZED',
            message: 'A provider payment already exists for this order.',
            details: { paymentId: latest.id },
          });
        }
        if (latest?.status === 'PENDING' && latest.providerPaymentId === marker) {
          // A different idempotency key must not reuse the outstanding claim.
          // A resumed claim has already been recorded with the same key; verify
          // that its ownership was established by the original operation.
          if (await this.idempotency.hasCompetingUnfinishedClaim(
            principal.userId, operation, idempotency, transaction,
          )) {
            throw new ApiException(409, { code: 'PAYMENT_INITIATION_IN_PROGRESS',
              message: 'Retry the original payment initiation with its original Idempotency-Key.' });
          }
        }
        // The order deadline applies to a NEW claim; once committed, expiration
        // must wait until the external provider outcome is reconciled.
        if (order.paymentExpiresAt && order.paymentExpiresAt.getTime() <= Date.now() &&
            latest?.providerPaymentId !== marker) throw new ApiException(409, {
          code: 'ORDER_PAYMENT_EXPIRED', message: 'The payment window has expired. Please begin a new checkout.',
          details: { orderId },
        });
        let claimedRecord: PaymentRecord;
        if (latest?.status === 'PENDING') {
          claimedRecord = latest.provider === 'INTERNAL_PENDING'
            ? await this.repository.initializePendingPayment(paymentId, provider.id, marker, transaction)
            : latest;
        } else {
          claimedRecord = await this.repository.createProviderPendingPayment({
            id: paymentId, orderId, buyerId: principal.userId, provider: provider.id,
            providerPaymentId: marker, amount: this.money(order.totalAmount), currency: order.currency,
          }, transaction);
        }
        return { paymentId, amount: this.money(order.totalAmount), currency: order.currency,
          startedAt: claimedRecord.updatedAt };
      });
    } catch (error) {
      if (this.hasPrismaCode(error, 'P2002')) {
        const after = await this.idempotency.replayOrPermitInProgress<unknown>(principal.userId, operation, idempotency);
        if (after) return PaymentInitiationSchema.parse(after);
      }
      throw error;
    }
    if ('replay' in claimed) return PaymentInitiationSchema.parse(claimed.replay);
    // Stripe retains idempotency results for a bounded time. An ambiguous
    // request older than this safety window is quarantined for reconciliation,
    // rather than re-creating a potentially paid session with the same key.
    if (provider.id === 'stripe' && Date.now() - claimed.startedAt.getTime() > 20 * 60 * 60 * 1000) {
      throw new ApiException(409, { code: 'PAYMENT_INITIATION_RECONCILIATION_REQUIRED',
        message: 'This payment attempt requires provider reconciliation before retrying.' });
    }

    // Contact the provider outside the SQL transaction.
    // The provider uses the committed payment UUID for its stable idempotency key.
    const created = await provider.createPayment({
      paymentId: claimed.paymentId, orderId, amount: claimed.amount,
      currency: claimed.currency, idempotencyKey,
    });
    if (created.provider !== provider.id) throw new ApiException(502, {
      code: 'PAYMENT_PROVIDER_MISMATCH', message: 'The provider returned an unexpected identifier.',
    });

    // Atomically bind the external session and complete idempotency.
    // A crash before commit remains recoverable via the original payment UUID.
    return this.transactions.runSerializable(async (transaction) => {
      const replay = await this.idempotency.replayOrPermitInProgress<unknown>(principal.userId, operation, idempotency, transaction);
      if (replay) return PaymentInitiationSchema.parse(replay);
      const order = await this.orders.paymentContext(orderId, transaction);
      if (!order || order.status !== 'PENDING_PAYMENT') throw new ApiException(409, {
        code: 'PAYMENT_RECONCILIATION_REQUIRED',
        message: 'Order status changed during provider initialization; reconciliation is required.',
      });
      const current = await this.repository.findById(claimed.paymentId, transaction);
      const marker = `tradenest_init_${claimed.paymentId}`;
      if (!current || current.status !== 'PENDING' || current.provider !== provider.id ||
          ![marker, created.providerPaymentId].includes(current.providerPaymentId)) {
        throw new ApiException(409, { code: 'PAYMENT_RECONCILIATION_REQUIRED',
          message: 'The payment changed while initializing; reconciliation is required.' });
      }
      const payment = current.providerPaymentId === marker
        ? await this.repository.initializePendingPayment(current.id, created.provider, created.providerPaymentId, transaction)
        : current;
      const response = PaymentInitiationSchema.parse({
        payment: this.map(payment),
        ...(created.checkoutUrl ? { checkoutUrl: created.checkoutUrl } : {}),
      });
      await this.idempotency.complete(principal.userId, operation, idempotency, response, transaction);
      return response;
    });
  }

  async get(principal: AuthPrincipal, paymentId: string): Promise<Payment> {
    this.authorization.requireRole(principal, ['BUYER', 'ADMIN']);
    const row = await this.repository.findById(paymentId);
    if (!row) throw this.notFound();
    this.authorization.requireOwnership(principal, row.buyerId, {
      allowAdmin: true,
      conceal: true,
      resourceCode: 'PAYMENT_NOT_FOUND',
    });
    return PaymentSchema.parse(this.map(row));
  }

  async handleWebhook(
    providerId: string,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
    sourceIp = 'unknown',
  ): Promise<PaymentWebhookAcknowledgement | { received: true; ignored: true }> {
    const provider = this.providers.byId(providerId);
    let event: VerifiedPaymentEvent | null;
    try {
      event = provider.verifyWebhook({ rawBody, headers });
    } catch (error) {
      if (this.isInvalidWebhookSignature(error)) {
        this.rateLimits.assertAllowed('PAYMENT_WEBHOOK_INVALID_SIGNATURE_IP', `provider:${provider.id}:ip:${sourceIp.slice(0, 128)}`);
      }
      throw error;
    }
    // Only recognized, terminal provider events affect authoritative payment state.
    if (!event) return { received: true, ignored: true };
    const payment = await this.repository.findByProviderPaymentId(provider.id, event.providerPaymentId);
    if (!payment) throw this.notFound();
    this.assertProviderAmounts(payment, event);

    const acknowledgement = await this.transactions.runSerializable(async (transaction) => {
      const current = await this.repository.findById(payment.id, transaction);
      if (!current || current.provider !== provider.id || current.providerPaymentId !== event.providerPaymentId) throw this.notFound();
      this.assertProviderAmounts(current, event);

      if (event.type === 'PAYMENT_SUCCEEDED') {
        if (current.status === 'SUCCEEDED') {
          return PaymentWebhookAcknowledgementSchema.parse({ received: true, duplicate: true, paymentId: current.id, status: 'SUCCEEDED' });
        }
        if (current.status !== 'PENDING') throw this.invalidPaymentTransition(current.status, 'SUCCEEDED');
        // Acquire the same order lock used by the sweeper BEFORE marking payment
        // succeeded. Never consume released stock or create escrow for a closed order.
        const verifiedOrder = await this.orders.paymentContext(current.orderId, transaction);
        if (!verifiedOrder || verifiedOrder.status !== 'PENDING_PAYMENT') {
          this.logger.error(`Provider payment ${current.id} succeeded for non-payable order ${current.orderId}; provider reconciliation/refund required.`);
          throw new ApiException(409, {
            code: 'PAYMENT_RECONCILIATION_REQUIRED',
            message: 'Provider payment succeeded after the order became ineligible; manual reconciliation is required.',
            details: { paymentId: current.id, orderId: current.orderId, orderStatus: verifiedOrder?.status ?? null },
          });
        }

        await this.repository.markSucceeded(current.id, event.occurredAt, transaction);
        await this.orders.markPaidFromVerifiedPayment(current.orderId, event.occurredAt, transaction);
        const inventoryCommitments = await this.orders.paymentInventoryCommitments(current.orderId, transaction);
        if (inventoryCommitments.length === 0) {
          throw new ApiException(409, {
            code: 'INVALID_INVENTORY_RESERVATION',
            message: 'The paid order has no inventory commitments to finalize.',
            details: { orderId: current.orderId },
          });
        }
        for (const item of inventoryCommitments) {
          await this.catalog.consumeInventoryReservation(item.productId, item.quantity, transaction);
        }
        await this.escrow.holdVerifiedPayment({
          orderId: current.orderId,
          paymentId: current.id,
          amount: this.money(current.amount.toString()),
          reference: `${event.provider}:${event.eventId}:${event.providerPaymentId}`.slice(0, 255),
          heldAt: event.occurredAt,
        }, transaction);
        await this.notifications.record({ key: `PAYMENT_SUCCEEDED:${current.id}`, type: 'PAYMENT_SUCCEEDED',
          title: 'Payment confirmed', body: 'Your payment was verified and the order escrow is now held.',
          recipients: [current.buyerId],
        }, transaction);
        return PaymentWebhookAcknowledgementSchema.parse({ received: true, duplicate: false, paymentId: current.id, status: 'SUCCEEDED' });
      }

      if (current.status === 'SUCCEEDED') {
        return PaymentWebhookAcknowledgementSchema.parse({ received: true, duplicate: true, paymentId: current.id, status: 'SUCCEEDED' });
      }
      if (current.status === 'FAILED') {
        return PaymentWebhookAcknowledgementSchema.parse({ received: true, duplicate: true, paymentId: current.id, status: 'FAILED' });
      }
      if (current.status !== 'PENDING') throw this.invalidPaymentTransition(current.status, 'FAILED');
      await this.repository.markFailed(current.id, event.failureCode ?? null, event.failureMessage ?? null, transaction);
      await this.notifications.record({ key: `PAYMENT_FAILED:${current.id}`, type: 'PAYMENT_FAILED',
        title: 'Payment failed', body: 'Your payment was not successful. Check the order before retrying.',
        recipients: [current.buyerId],
      }, transaction);
      return PaymentWebhookAcknowledgementSchema.parse({ received: true, duplicate: false, paymentId: current.id, status: 'FAILED' });
    });

    if (!acknowledgement.duplicate && acknowledgement.status !== 'PENDING') {
      try {
        await this.aiBridge.assessPaymentRisk({
          userId: payment.buyerId,
          orderId: payment.orderId,
          paymentId: payment.id,
          amount: this.money(payment.amount.toString()),
          currency: payment.currency,
          outcome: acknowledgement.status,
          occurredAt: event.occurredAt.toISOString(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown fraud-risk assessment failure';
        this.logger.warn(`Payment ${payment.id} completed without fraud-risk assessment: ${message}`);
      }
    }

    return acknowledgement;
  }


  private isInvalidWebhookSignature(error: unknown): boolean {
    if (!(error instanceof ApiException) || error.getStatus() !== 401) return false;
    const response = error.getResponse();
    return typeof response === 'object' && response !== null && 'code' in response
      && (response as { code?: unknown }).code === 'PAYMENT_WEBHOOK_SIGNATURE_INVALID';
  }

  private async requirePayableOrder(
    principal: AuthPrincipal,
    orderId: string,
    transaction?: DatabaseTransactionContext,
  ): Promise<PaymentOrderContext> {
    const order = await this.orders.paymentContext(orderId, transaction);
    if (!order) throw new ApiException(404, { code: 'ORDER_NOT_FOUND', message: 'The requested order was not found.' });
    this.authorization.requireOwnership(principal, order.buyerId, { conceal: true, resourceCode: 'ORDER_NOT_FOUND' });
    if (order.status !== 'PENDING_PAYMENT') {
      throw new ApiException(409, {
        code: 'ORDER_NOT_PAYABLE',
        message: 'The order is not eligible for payment creation.',
        details: { orderId, status: order.status },
      });
    }
    // Under the same order row lock as the expiration sweeper. An expired order
    // must not acquire a new external payment attempt before inventory release.
    if (order.paymentExpiresAt && order.paymentExpiresAt.getTime() <= Date.now()) {
      throw new ApiException(409, {
        code: 'ORDER_PAYMENT_EXPIRED',
        message: 'The payment window has expired. Please begin a new checkout.',
        details: { orderId },
      });
    }
    return order;
  }

  private assertProviderAmounts(payment: PaymentRecord, event: VerifiedPaymentEvent): void {
    if (this.toMinor(payment.amount.toString()) !== this.toMinor(event.amount) || payment.currency !== event.currency) {
      throw new ApiException(409, {
        code: 'PAYMENT_WEBHOOK_AMOUNT_MISMATCH',
        message: 'The provider amount or currency does not match the authoritative payment record.',
        details: { paymentId: payment.id },
      });
    }
  }

  private map(row: PaymentRecord) {
    return {
      id: row.id,
      orderId: row.orderId,
      provider: row.provider,
      providerPaymentId: row.providerPaymentId,
      status: row.status,
      amount: this.money(row.amount.toString()),
      currency: row.currency,
      failureCode: row.failureCode,
      failureMessage: row.failureMessage,
      paidAt: row.paidAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private requireIdempotencyKey(value: string | undefined): string {
    const parsed = PaymentIdempotencyKeySchema.safeParse(value);
    if (!parsed.success) {
      throw new ApiException(400, {
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'A valid Idempotency-Key header is required for payment creation.',
      });
    }
    return parsed.data;
  }

  private money(value: string): string {
    const minor = this.toMinor(value);
    return `${minor / 100n}.${(minor % 100n).toString().padStart(2, '0')}`;
  }

  private toMinor(value: string): bigint {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
    if (!match) throw new Error(`Invalid authoritative money value: ${value}`);
    return BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  }

  private notFound(): ApiException {
    return new ApiException(404, { code: 'PAYMENT_NOT_FOUND', message: 'The requested payment was not found.' });
  }

  private alreadyPaid(orderId: string): ApiException {
    return new ApiException(409, { code: 'ORDER_ALREADY_PAID', message: 'The order already has a successful payment.', details: { orderId } });
  }

  private invalidPaymentTransition(current: string, requested: string): ApiException {
    return new ApiException(409, {
      code: 'INVALID_STATE_TRANSITION',
      message: 'The payment cannot transition from its current state.',
      details: { currentStatus: current, requestedStatus: requested },
    });
  }
  private hasPrismaCode(error: unknown, code: string): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === code;
  }

}
