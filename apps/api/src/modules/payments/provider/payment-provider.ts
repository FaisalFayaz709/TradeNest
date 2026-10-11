export interface CreateProviderPaymentInput {
  paymentId: string;
  orderId: string;
  amount: string;
  currency: string;
  idempotencyKey: string;
}

export interface CreatedProviderPayment {
  provider: string;
  providerPaymentId: string;
  checkoutUrl?: string; // hosted checkout URL; never proof of payment
}

export interface RefundProviderPaymentInput {
  paymentId: string;
  providerPaymentId: string;
  amount: string;
  currency: string;
  idempotencyKey: string;
  reconcileOnly?: boolean;
}

export interface RefundedProviderPayment {
  provider: string;
  providerRefundId: string | null;
  status: 'SUCCEEDED' | 'PENDING' | 'NEEDS_REVIEW';
}

export interface VerifiedPaymentEvent {
  eventId: string;
  provider: string;
  type: 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED';
  providerPaymentId: string;
  amount: string;
  currency: string;
  occurredAt: Date;
  failureCode?: string;
  failureMessage?: string;
}

export interface VerifyWebhookInput {
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
}

export interface PaymentProvider {
  readonly id: string;
  createPayment(input: CreateProviderPaymentInput): Promise<CreatedProviderPayment>;
  refundPayment(input: RefundProviderPaymentInput): Promise<RefundedProviderPayment>;
  expireUnpaidPayment?(providerPaymentId: string, amount: string, currency: string): Promise<boolean>;
  verifyWebhook(input: VerifyWebhookInput): VerifiedPaymentEvent | null;
}
