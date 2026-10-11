import { z } from 'zod';
import { FinancialIdempotencyKeySchema } from '../common/idempotency.js';

export const PaymentStatusSchema = z.enum(['PENDING', 'SUCCEEDED', 'FAILED']);
export const PaymentIdempotencyKeySchema = FinancialIdempotencyKeySchema;

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  provider: z.string().min(1),
  providerPaymentId: z.string().min(1),
  status: PaymentStatusSchema,
  amount: z.string().regex(/^\d+\.\d{2}$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  failureCode: z.string().nullable(),
  failureMessage: z.string().nullable(),
  paidAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PaymentInitiationSchema = z.object({
  payment: PaymentSchema,
  checkoutUrl: z.string().url().startsWith('https://checkout.stripe.com/').optional(),
});

export const PaymentWebhookAcknowledgementSchema = z.object({
  received: z.literal(true),
  duplicate: z.boolean(),
  paymentId: z.string().uuid(),
  status: PaymentStatusSchema,
});

export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type PaymentInitiation = z.infer<typeof PaymentInitiationSchema>;
export type PaymentWebhookAcknowledgement = z.infer<typeof PaymentWebhookAcknowledgementSchema>;
