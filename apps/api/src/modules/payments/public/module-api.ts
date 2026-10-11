import type { Payment } from '@tradenest/contracts/payments';
import type { DatabaseTransactionContext } from '../../../database/database-transaction.service.js';

export interface PendingCheckoutPayment {
  id: string;
  orderId: string;
  status: 'PENDING';
  amount: string;
  currency: string;
}

export interface CreatePendingCheckoutPaymentInput {
  orderId: string;
  buyerId: string;
  amount: string;
  currency: string;
}

export interface RefundSucceededPaymentInput {
  paymentId: string;
  amount: string;
  idempotencyKey: string;
  reconcileOnly?: boolean;
}

export interface RefundPaymentContext { provider: string; currency: string; }

export interface ProviderRefundResult {
  provider: string;
  providerRefundId: string | null;
  status: 'SUCCEEDED' | 'PENDING' | 'NEEDS_REVIEW';
}

export interface OrderCancellationPaymentContext {
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | null;
  provider: string | null;
  externalPending: boolean;
}

/** Public payment-record/provider seam used by checkout and escrow financial workflows. */
export interface PaymentsModuleApi {
  adminListPayments(page: number, limit: number): Promise<{ rows: Payment[]; total: number }>;
  createPendingCheckoutPayment(
    input: CreatePendingCheckoutPaymentInput,
    transaction: DatabaseTransactionContext,
  ): Promise<PendingCheckoutPayment>;
  refundContext(paymentId: string, amount: string, transaction: DatabaseTransactionContext): Promise<RefundPaymentContext>;
  refundSucceededPayment(
    input: RefundSucceededPaymentInput,
    transaction?: DatabaseTransactionContext,
  ): Promise<ProviderRefundResult>;
  expireUnpaidExternalPayment(orderId: string): Promise<boolean>;
  orderCancellationContext(
    orderId: string,
    transaction: DatabaseTransactionContext,
  ): Promise<OrderCancellationPaymentContext>;
}

export const PAYMENTS_MODULE_API = Symbol('PAYMENTS_MODULE_API');
