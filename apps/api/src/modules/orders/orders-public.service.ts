import { Injectable } from '@nestjs/common';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { assertOrderTransition, invalidOrderTransition } from './order-state-machine.js';
import { OrdersRepository } from './orders.repository.js';
import type { DisputeOrderContext, EscrowOrderAccessContext, OrdersModuleApi, PaymentInventoryCommitment, PaymentOrderContext, ShippingOrderContext } from './public/module-api.js';

@Injectable()
export class OrdersPublicService implements OrdersModuleApi {
  async adminListOrders(page: number, limit: number) {
    const result = await this.repository.listAdminOrders(page, limit);
    return { rows: result.rows.map((row) => this.toSummary(row)), total: result.total };
  }

  constructor(private readonly repository: OrdersRepository) {}

  async paymentContext(orderId: string, transaction?: DatabaseTransactionContext): Promise<PaymentOrderContext | null> {
    const row = await this.repository.findPaymentContext(orderId, transaction);
    return row ? { ...row, totalAmount: row.totalAmount.toString() } : null;
  }

  async paymentInventoryCommitments(
    orderId: string,
    transaction?: DatabaseTransactionContext,
  ): Promise<PaymentInventoryCommitment[]> {
    const rows = await this.repository.findPaymentInventoryCommitments(orderId, transaction);
    return rows.map((row) => ({ productId: row.productId, quantity: row.quantity }));
  }

  async escrowAccessContext(orderId: string, transaction?: DatabaseTransactionContext): Promise<EscrowOrderAccessContext | null> {
    const row = await this.repository.findEscrowAccessContext(orderId, transaction);
    if (!row) return null;
    return {
      id: row.id,
      buyerId: row.buyerId,
      status: row.status,
      sellerIds: [...new Set(row.items.map((item) => item.sellerId))],
    };
  }

  async shippingContext(orderId: string, transaction?: DatabaseTransactionContext): Promise<ShippingOrderContext | null> {
    const row = await this.repository.findShippingContext(orderId, transaction);
    if (!row) return null;
    return {
      id: row.id,
      buyerId: row.buyerId,
      status: row.status,
      sellerIds: [...new Set(row.items.map((item) => item.sellerId))],
    };
  }


  async disputeContext(orderId: string, transaction?: DatabaseTransactionContext): Promise<DisputeOrderContext | null> {
    const row = await this.repository.findDisputeContext(orderId, transaction);
    if (!row) return null;
    return {
      id: row.id,
      buyerId: row.buyerId,
      status: row.status,
      sellerIds: [...new Set(row.items.map((item) => item.sellerId))],
    };
  }

  async markDisputedFromDispute(orderId: string, transaction: DatabaseTransactionContext): Promise<void> {
    const current = await this.repository.findDisputeContext(orderId, transaction);
    if (!current) throw invalidOrderTransition(null, 'DISPUTED');
    if (current.status === 'DISPUTED') return;
    assertOrderTransition(current.status, 'DISPUTED', ['PAID', 'PROCESSING', 'SHIPPED']);
    const changed = await this.repository.markDisputedFromDispute(orderId, transaction);
    if (!changed) throw invalidOrderTransition(current.status, 'DISPUTED');
  }

  async markShippedFromShipment(orderId: string, transaction: DatabaseTransactionContext): Promise<void> {
    const current = await this.repository.findShippingContext(orderId, transaction);
    if (!current) throw invalidOrderTransition(null, 'SHIPPED');
    if (current.status === 'SHIPPED') return;
    assertOrderTransition(current.status, 'SHIPPED', ['PAID', 'PROCESSING']);
    const changed = await this.repository.markShippedFromShipment(orderId, transaction);
    if (!changed) throw invalidOrderTransition(current.status, 'SHIPPED');
  }

  async markPaidFromVerifiedPayment(orderId: string, paidAt: Date, transaction: DatabaseTransactionContext): Promise<void> {
    const current = await this.repository.findPaymentContext(orderId, transaction);
    if (!current) throw invalidOrderTransition(null, 'PAID');
    if (current.status === 'PAID') return;
    assertOrderTransition(current.status, 'PAID', ['PENDING_PAYMENT']);
    const changed = await this.repository.markPaid(orderId, paidAt, transaction);
    if (!changed) throw invalidOrderTransition(current.status, 'PAID');
  }

  async markCompletedFromEscrowRelease(orderId: string, transaction: DatabaseTransactionContext): Promise<void> {
    const current = await this.repository.findPaymentContext(orderId, transaction);
    if (!current) throw invalidOrderTransition(null, 'COMPLETED');
    if (current.status === 'COMPLETED') return;
    assertOrderTransition(current.status, 'COMPLETED', ['DELIVERED', 'DISPUTED']);
    const changed = await this.repository.markCompletedFromEscrowRelease(orderId, transaction);
    if (!changed) throw invalidOrderTransition(current.status, 'COMPLETED');
  }

  async markRefundedFromEscrowRefund(orderId: string, transaction: DatabaseTransactionContext): Promise<void> {
    const current = await this.repository.findPaymentContext(orderId, transaction);
    if (!current) throw invalidOrderTransition(null, 'REFUNDED');
    if (current.status === 'REFUNDED') return;
    assertOrderTransition(current.status, 'REFUNDED', ['PAID', 'PROCESSING', 'DISPUTED']);
    const changed = await this.repository.markRefundedFromEscrowRefund(orderId, transaction);
    if (!changed) throw invalidOrderTransition(current.status, 'REFUNDED');
  }
  private toSummary(row: any) {
    return {
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
    };
  }

  private money(value: string): string {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
    if (!match) throw new Error(`Invalid authoritative money value: ${value}`);
    return `${match[1]}.${(match[2] ?? '').padEnd(2, '0')}`;
  }
}
