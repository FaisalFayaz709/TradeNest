import { z } from 'zod';

/**
 * Development sandbox-provider webhook contract.
 * This is an implementation decision, not a locked production-provider contract.
 */
export const SandboxPaymentWebhookSchema = z.object({
  eventId: z.string().uuid(),
  type: z.enum(['PAYMENT_SUCCEEDED', 'PAYMENT_FAILED']),
  providerPaymentId: z.string().min(1).max(255),
  amount: z.string().regex(/^\d+\.\d{2}$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  occurredAt: z.string().datetime(),
  failureCode: z.string().trim().min(1).max(128).optional(),
  failureMessage: z.string().trim().min(1).max(2000).optional(),
}).strict();

export type SandboxPaymentWebhook = z.infer<typeof SandboxPaymentWebhookSchema>;
