import { NOTIFICATIONS_MODULE_API, type NotificationsModuleApi } from '../notifications/public/module-api.js';
import { Inject, Injectable } from '@nestjs/common';
import { FinancialIdempotencyKeySchema } from '@tradenest/contracts/common';
import {
  OrderListQuerySchema,
  OrderSchema,
  OrderSummarySchema,
  type Order,
  type OrderListQuery,
  type OrderSummary,
} from '@tradenest/contracts/orders';
import { AuthorizationService } from '../../common/authorization/index.js';
import { ApiException } from '../../common/http/api-exception.js';
import { FinancialIdempotencyService } from '../../common/idempotency/index.js';
import { DatabaseTransactionService } from '../../database/database-transaction.service.js';
import type { AuthPrincipal } from '../auth/public/index.js';
import { CATALOG_MODULE_API, type CatalogModuleApi } from '../catalog/public/module-api.js';
import { DISPUTES_MODULE_API, type DisputesModuleApi } from '../disputes/public/module-api.js';
import { ESCROW_MODULE_API, type EscrowModuleApi } from '../escrow/public/module-api.js';
import { PAYMENTS_MODULE_API, type PaymentsModuleApi } from '../payments/public/module-api.js';
import { SHIPPING_MODULE_API, type ShippingModuleApi } from '../shipping/public/module-api.js';
import { OrdersRepository } from './orders.repository.js';
import { assertOrderTransition, invalidOrderTransition } from './order-state-machine.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly repository: OrdersRepository,
    private readonly authorization: AuthorizationService,
    private readonly transactions: DatabaseTransactionService,
    private readonly idempotency: FinancialIdempotencyService,
    @Inject(CATALOG_MODULE_API) private readonly catalog: CatalogModuleApi,
    @Inject(PAYMENTS_MODULE_API) private readonly payments: PaymentsModuleApi,
    @Inject(ESCROW_MODULE_API) private readonly escrow: EscrowModuleApi,
    @Inject(SHIPPING_MODULE_API) private readonly shipping: ShippingModuleApi,
    @Inject(NOTIFICATIONS_MODULE_API) private readonly notifications: NotificationsModuleApi,
    @Inject(DISPUTES_MODULE_API) private readonly disputes: DisputesModuleApi,
  ) {}

  async listBuyerOrders(principal: AuthPrincipal, input: OrderListQuery) {
    this.authorization.requireRole(principal, ['BUYER']);
    const query = OrderListQuerySchema.parse(input);
    const result = await this.repository.listBuyerOrders(principal.userId, query.page, query.limit);
    return {
      data: result.rows.map((row) => this.toSummary(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }

  async listSellerOrders(principal: AuthPrincipal, input: OrderListQuery) {
    this.authorization.requireRole(principal, ['SELLER']);
    const query = OrderListQuerySchema.parse(input);
    const result = await this.repository.listSellerOrders(principal.userId, query.page, query.limit);
    return {
      data: result.rows.map((row) => this.toSummary(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }

  async getOrder(principal: AuthPrincipal, orderId: string): Promise<Order> {
    this.authorization.requireRole(principal, ['BUYER', 'SELLER', 'ADMIN']);
    const row = await this.repository.findOrderDetail(orderId);
    if (!row) throw this.notFound();
    if (principal.role !== 'ADMIN') {
      const participant = row.buyerId === principal.userId || row.items.some((item) => item.sellerId === principal.userId);
      if (!participant) throw this.notFound();
    }
    return this.toOrder(row);
  }

  async cancel(principal: AuthPrincipal, orderId: string): Promise<Order> {
    this.authorization.requireRole(principal, ['BUYER']);
    return this.transactions.runSerializable(async (transaction) => {
      const locked = await this.repository.lockById(orderId, transaction);
      if (!locked) throw this.notFound();
      const order = await this.repository.findOrderDetail(orderId, transaction);
      if (!order) throw this.notFound();
      this.authorization.requireOwnership(principal, order.buyerId, {
        conceal: true,
        resourceCode: 'ORDER_NOT_FOUND',
      });

      if (order.status === 'CANCELLED') return this.toOrder(order);
      assertOrderTransition(order.status, 'CANCELLED', ['PENDING_PAYMENT']);

      const payment = await this.payments.orderCancellationContext(orderId, transaction);
      if (payment.externalPending) {
        throw invalidOrderTransition(order.status, 'CANCELLED', 'A provider payment is already in progress.');
      }
      if (payment.status === 'SUCCEEDED') throw invalidOrderTransition(order.status, 'CANCELLED');

      const changed = await this.repository.cancelPendingPaymentOrder(orderId, new Date(), transaction);
      if (!changed) {
        const current = await this.repository.findOrderDetail(orderId, transaction);
        if (current?.status === 'CANCELLED') return this.toOrder(current);
        throw invalidOrderTransition(current?.status ?? order.status, 'CANCELLED');
      }

      for (const item of order.items) {
        await this.catalog.releaseInventoryReservation(item.productId, item.quantity, transaction);
      }
      await this.notifications.record({ key: `ORDER_CANCELLED:${orderId}`, type: 'ORDER_CANCELLED',
        title: 'Order cancelled', body: 'Your unpaid order was cancelled and reserved stock was released.',
        recipients: [order.buyerId, ...new Set(order.items.map(item => item.sellerId))],
      }, transaction);

      const cancelled = await this.repository.findOrderDetail(orderId, transaction);
      if (!cancelled) throw this.notFound();
      return this.toOrder(cancelled);
    });
  }

  async confirmDelivery(
    principal: AuthPrincipal,
    orderId: string,
    rawIdempotencyKey: string | undefined,
    requestId?: string,
  ): Promise<Order> {
    this.authorization.requireRole(principal, ['BUYER']);
    const key = this.requireIdempotencyKey(rawIdempotencyKey);
    const operation = 'BUYER_CONFIRM_DELIVERY';
    const token = this.idempotency.prepare(key, { orderId });
    const replay = await this.idempotency.replayOrThrow<unknown>(principal.userId, operation, token);
    if (replay) return OrderSchema.parse(replay);

    try {
      return await this.transactions.runSerializable(async (transaction) => {
        const transactionReplay = await this.idempotency.claimOrReplay<unknown>(principal.userId, operation, token, transaction);
        if (transactionReplay) return OrderSchema.parse(transactionReplay);

        const locked = await this.repository.lockById(orderId, transaction);
        if (!locked) throw this.notFound();
        const before = await this.repository.findOrderDetail(orderId, transaction);
        if (!before) throw this.notFound();
        this.authorization.requireOwnership(principal, before.buyerId, {
          conceal: true,
          resourceCode: 'ORDER_NOT_FOUND',
        });

        assertOrderTransition(before.status, 'DELIVERED', ['SHIPPED']);

        if (await this.disputes.hasActiveDispute(orderId, transaction)) {
          throw new ApiException(409, {
            code: 'INVALID_STATE_TRANSITION',
            message: 'Delivery cannot be confirmed while a dispute is active.',
            details: { orderId, currentStatus: before.status, requestedStatus: 'DELIVERED', reason: 'ACTIVE_DISPUTE' },
          });
        }

        const escrow = await this.escrow.shippingContext(orderId, transaction);
        if (!escrow || escrow.status !== 'SELLER_SHIPPED') {
          throw new ApiException(409, {
            code: 'INVALID_STATE_TRANSITION',
            message: 'Delivery cannot be confirmed unless seller-shipped escrow is awaiting buyer confirmation.',
            details: { orderId, escrowStatus: escrow?.status ?? null, requestedStatus: 'BUYER_CONFIRMED' },
          });
        }

        const deliveredAt = new Date();
        if (!await this.repository.markDeliveredFromBuyerConfirmation(orderId, transaction)) {
          const current = await this.repository.findOrderDetail(orderId, transaction);
          throw invalidOrderTransition(current?.status ?? before.status, 'DELIVERED');
        }
        await this.shipping.markDeliveredFromBuyerConfirmation(orderId, deliveredAt, transaction);
        await this.escrow.confirmBuyerAndRelease({
          orderId,
          buyerId: principal.userId,
          releasedAt: deliveredAt,
          reference: `buyer-confirm:${principal.userId}:${orderId}`.slice(0, 255),
          requestId: this.cleanRequestId(requestId),
        }, transaction);

        const delivered = await this.repository.findOrderDetail(orderId, transaction);
        if (!delivered) throw this.notFound();
        assertOrderTransition(delivered.status, 'COMPLETED', ['DELIVERED']);
        if (!await this.repository.markCompletedFromEscrowRelease(orderId, transaction)) {
          const current = await this.repository.findOrderDetail(orderId, transaction);
          throw invalidOrderTransition(current?.status ?? delivered.status, 'COMPLETED');
        }

        const completed = await this.repository.findOrderDetail(orderId, transaction);
        if (!completed) throw this.notFound();
        const response = this.toOrder(completed);
        await this.notifications.record({ key: `ORDER_COMPLETED:${orderId}`, type: 'ORDER_COMPLETED',
          title: 'Order completed', body: 'Delivery was confirmed and escrow release was recorded.',
          recipients: [completed.buyerId, ...new Set(completed.items.map(item => item.sellerId))],
        }, transaction);
        await this.idempotency.complete(principal.userId, operation, token, response, transaction);
        return response;
      });
    } catch (error) {
      if (this.hasPrismaCode(error, 'P2002')) {
        const concurrentReplay = await this.idempotency.replayOrThrow<unknown>(principal.userId, operation, token);
        if (concurrentReplay) return OrderSchema.parse(concurrentReplay);
      }
      throw error;
    }
  }

  private toSummary(row: any): OrderSummary {
    return OrderSummarySchema.parse({
      id: row.id,
      orderNumber: row.orderNumber,
      buyerId: row.buyerId,
      status: row.status,
      currency: row.currency,
      subtotal: this.money(row.subtotal.toString()),
      shippingAmount: this.money(row.shippingAmount.toString()),
      discountAmount: this.money(row.discountAmount.toString()),
      totalAmount: this.money(row.totalAmount.toString()),
      paidAt: row.paidAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  private toOrder(row: any): Order {
    return OrderSchema.parse({
      ...this.toSummary(row),
      shippingAddress: row.shippingAddress,
      items: row.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        sellerId: item.sellerId,
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: this.money(item.unitPrice.toString()),
        totalPrice: this.money(item.totalPrice.toString()),
        createdAt: item.createdAt.toISOString(),
      })),
    });
  }

  private requireIdempotencyKey(raw: string | undefined): string {
    const result = FinancialIdempotencyKeySchema.safeParse(raw);
    if (result.success) return result.data;
    throw new ApiException(400, {
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'A valid Idempotency-Key header is required for delivery confirmation.',
    });
  }

  private cleanRequestId(value: string | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned.slice(0, 128) : null;
  }

  private hasPrismaCode(error: unknown, code: string): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === code;
  }

  private money(value: string): string {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
    if (!match) throw new Error(`Invalid authoritative money value: ${value}`);
    return `${match[1]}.${(match[2] ?? '').padEnd(2, '0')}`;
  }

  private notFound(): ApiException {
    return new ApiException(404, { code: 'ORDER_NOT_FOUND', message: 'The requested order was not found.' });
  }
}
