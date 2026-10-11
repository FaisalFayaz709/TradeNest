import type { OrderSummary } from '@tradenest/contracts/orders';
import type { DatabaseTransactionContext } from '../../../database/database-transaction.service.js';

export interface PaymentOrderContext {
  id: string;
  buyerId: string;
  status: 'PENDING_PAYMENT' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED' | 'REFUNDED';
  currency: string;
  totalAmount: string;
  paymentExpiresAt: Date | null;
}


export interface PaymentInventoryCommitment {
  productId: string;
  quantity: number;
}

export interface ShippingOrderContext {
  id: string;
  buyerId: string;
  status: PaymentOrderContext['status'];
  sellerIds: string[];
}

export interface EscrowOrderAccessContext {
  id: string;
  buyerId: string;
  status: PaymentOrderContext['status'];
  sellerIds: string[];
}

export interface DisputeOrderContext extends EscrowOrderAccessContext {}

export interface OrdersModuleApi {
  adminListOrders(page: number, limit: number): Promise<{ rows: OrderSummary[]; total: number }>;
  paymentContext(orderId: string, transaction?: DatabaseTransactionContext): Promise<PaymentOrderContext | null>;
  paymentInventoryCommitments(orderId: string, transaction?: DatabaseTransactionContext): Promise<PaymentInventoryCommitment[]>;
  escrowAccessContext(orderId: string, transaction?: DatabaseTransactionContext): Promise<EscrowOrderAccessContext | null>;
  shippingContext(orderId: string, transaction?: DatabaseTransactionContext): Promise<ShippingOrderContext | null>;
  disputeContext(orderId: string, transaction?: DatabaseTransactionContext): Promise<DisputeOrderContext | null>;
  markShippedFromShipment(orderId: string, transaction: DatabaseTransactionContext): Promise<void>;
  markDisputedFromDispute(orderId: string, transaction: DatabaseTransactionContext): Promise<void>;
  markPaidFromVerifiedPayment(
    orderId: string,
    paidAt: Date,
    transaction: DatabaseTransactionContext,
  ): Promise<void>;
  markCompletedFromEscrowRelease(orderId: string, transaction: DatabaseTransactionContext): Promise<void>;
  markRefundedFromEscrowRefund(orderId: string, transaction: DatabaseTransactionContext): Promise<void>;
}

export const ORDERS_MODULE_API = Symbol('ORDERS_MODULE_API');
