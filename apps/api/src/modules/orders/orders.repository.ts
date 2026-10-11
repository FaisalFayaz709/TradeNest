import { Injectable } from '@nestjs/common';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';

export interface CreateOrderItemPersistenceInput {
  productId: string;
  sellerId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

export interface CreateOrderPersistenceInput {
  id: string;
  orderNumber: string;
  buyerId: string;
  paymentExpiresAt: Date;
  currency: string;
  subtotal: string;
  shippingAmount: string;
  discountAmount: string;
  totalAmount: string;
  shippingAddress: Prisma.InputJsonValue;
  items: CreateOrderItemPersistenceInput[];
}

export interface CheckoutOrderRecord {
  id: string;
  orderNumber: string;
  buyerId: string;
  status: 'PENDING_PAYMENT';
  currency: string;
  subtotal: { toString(): string };
  shippingAmount: { toString(): string };
  discountAmount: { toString(): string };
  totalAmount: { toString(): string };
  items: Array<{
    productId: string;
    sellerId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: { toString(): string };
    totalPrice: { toString(): string };
  }>;
}

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPendingPaymentOrder(
    input: CreateOrderPersistenceInput,
    transaction: DatabaseTransactionContext,
  ): Promise<CheckoutOrderRecord> {
    this.assertSingleSellerItems(input.items);
    const row = await transaction.client.order.create({
      data: {
        id: input.id,
        orderNumber: input.orderNumber,
        buyerId: input.buyerId,
        status: 'PENDING_PAYMENT',
        paymentExpiresAt: input.paymentExpiresAt,
        currency: input.currency,
        subtotal: input.subtotal,
        shippingAmount: input.shippingAmount,
        discountAmount: input.discountAmount,
        totalAmount: input.totalAmount,
        shippingAddress: input.shippingAddress,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            sellerId: item.sellerId,
            productName: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        },
      },
      include: { items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });
    return this.mapPendingOrder(row);
  }

  async listAdminOrders(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take: limit }),
      this.prisma.order.count(),
    ]);
    return { rows, total };
  }

  async listBuyerOrders(buyerId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { buyerId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: { buyerId } }),
    ]);
    return { rows, total };
  }

  async listSellerOrders(sellerId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = { items: { some: { sellerId } } };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { rows, total };
  }

  async findOrderDetail(orderId: string, transaction?: DatabaseTransactionContext) {
    return (transaction?.client ?? this.prisma).order.findUnique({
      where: { id: orderId },
      include: { items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });
  }

  async lockById(orderId: string, transaction: DatabaseTransactionContext): Promise<boolean> {
    const rows = await transaction.client.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE
    `;
    return rows.length === 1;
  }

  /** Bounded cursor avoids starving actionable orders behind unresolved provider payments. */
  async listExpiredPendingOrderIds(asOf: Date, limit: number, afterId: string | null): Promise<string[]> {
    const rows = await this.prisma.order.findMany({
      where: {
        status: 'PENDING_PAYMENT',
        paymentExpiresAt: { lte: asOf },
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: limit,
    });
    return rows.map((row) => row.id);
  }

  async cancelPendingPaymentOrder(
    orderId: string,
    cancelledAt: Date,
    transaction: DatabaseTransactionContext,
    expiredAt?: Date,
  ): Promise<boolean> {
    const result = await transaction.client.order.updateMany({
      where: { id: orderId, status: 'PENDING_PAYMENT', ...(expiredAt ? { paymentExpiresAt: { lte: expiredAt } } : {}) },
      data: { status: 'CANCELLED', cancelledAt },
    });
    return result.count === 1;
  }

  async findReviewPurchaseContext(orderId: string, orderItemId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        buyerId: true,
        status: true,
        items: {
          where: { id: orderItemId },
          select: { id: true, productId: true },
          take: 1,
        },
      },
    }).then((row) => {
      const item = row?.items[0];
      return row && item ? { buyerId: row.buyerId, status: row.status, orderItemId: item.id, productId: item.productId } : null;
    });
  }

  async findPaymentInventoryCommitments(orderId: string, transaction?: DatabaseTransactionContext) {
    return (transaction?.client ?? this.prisma).orderItem.findMany({
      where: { orderId },
      select: { productId: true, quantity: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async findPaymentContext(orderId: string, transaction?: DatabaseTransactionContext) {
    if (transaction) await this.lockById(orderId, transaction);
    return (transaction?.client ?? this.prisma).order.findUnique({
      where: { id: orderId },
      select: { id: true, buyerId: true, status: true, currency: true, totalAmount: true, paymentExpiresAt: true },
    });
  }

  async markPaid(orderId: string, paidAt: Date, transaction: DatabaseTransactionContext): Promise<boolean> {
    const result = await transaction.client.order.updateMany({
      where: { id: orderId, status: 'PENDING_PAYMENT' },
      data: { status: 'PAID', paidAt },
    });
    return result.count === 1;
  }

  async findShippingContext(orderId: string, transaction?: DatabaseTransactionContext) {
    if (transaction) await this.lockById(orderId, transaction);
    return (transaction?.client ?? this.prisma).order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        status: true,
        items: { select: { sellerId: true } },
      },
    });
  }


  async findDisputeContext(orderId: string, transaction?: DatabaseTransactionContext) {
    if (transaction) await this.lockById(orderId, transaction);
    return (transaction?.client ?? this.prisma).order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        status: true,
        items: { select: { sellerId: true } },
      },
    });
  }

  async markDisputedFromDispute(orderId: string, transaction: DatabaseTransactionContext): Promise<boolean> {
    const result = await transaction.client.order.updateMany({
      where: { id: orderId, status: { in: ['PAID', 'PROCESSING', 'SHIPPED'] } },
      data: { status: 'DISPUTED' },
    });
    return result.count === 1;
  }

  async markShippedFromShipment(orderId: string, transaction: DatabaseTransactionContext): Promise<boolean> {
    const result = await transaction.client.order.updateMany({
      where: { id: orderId, status: { in: ['PAID', 'PROCESSING'] } },
      data: { status: 'SHIPPED' },
    });
    return result.count === 1;
  }

  async markDeliveredFromBuyerConfirmation(
    orderId: string,
    transaction: DatabaseTransactionContext,
  ): Promise<boolean> {
    const result = await transaction.client.order.updateMany({
      where: { id: orderId, status: 'SHIPPED' },
      data: { status: 'DELIVERED' },
    });
    return result.count === 1;
  }

  async findEscrowAccessContext(orderId: string, transaction?: DatabaseTransactionContext) {
    return (transaction?.client ?? this.prisma).order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        status: true,
        items: { select: { sellerId: true } },
      },
    });
  }

  async markCompletedFromEscrowRelease(orderId: string, transaction: DatabaseTransactionContext): Promise<boolean> {
    const result = await transaction.client.order.updateMany({
      where: { id: orderId, status: { in: ['DELIVERED', 'DISPUTED'] } },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    return result.count === 1;
  }

  async markRefundedFromEscrowRefund(orderId: string, transaction: DatabaseTransactionContext): Promise<boolean> {
    const result = await transaction.client.order.updateMany({
      where: { id: orderId, status: { in: ['PAID', 'PROCESSING', 'DISPUTED'] } },
      data: { status: 'REFUNDED' },
    });
    return result.count === 1;
  }

  private assertSingleSellerItems(items: CreateOrderItemPersistenceInput[]): void {
    const sellerIds = new Set(items.map((item) => item.sellerId));
    if (sellerIds.size !== 1) throw new Error('SINGLE_SELLER_ORDER_INVARIANT_VIOLATION');
  }

  private mapPendingOrder(row: Omit<CheckoutOrderRecord, 'status'> & { status: string }): CheckoutOrderRecord {
    return { ...row, status: 'PENDING_PAYMENT' };
  }
}
