import { z } from 'zod';

export const EscrowStatusSchema = z.enum([
  'PENDING',
  'HELD',
  'SELLER_SHIPPED',
  'BUYER_CONFIRMED',
  'RELEASED',
  'DISPUTED',
  'UNDER_REVIEW',
  'REFUNDED',
]);

export const EscrowTransactionTypeSchema = z.enum(['HOLD', 'RELEASE', 'REFUND', 'ADJUSTMENT']);

export const EscrowTransactionSchema = z.object({
  id: z.string().uuid(),
  type: EscrowTransactionTypeSchema,
  amount: z.string().regex(/^\d+\.\d{2}$/),
  reference: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const EscrowSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  paymentId: z.string().uuid(),
  status: EscrowStatusSchema,
  amount: z.string().regex(/^\d+\.\d{2}$/),
  heldAt: z.string().datetime().nullable(),
  releasedAt: z.string().datetime().nullable(),
  refundedAt: z.string().datetime().nullable(),
  transactions: z.array(EscrowTransactionSchema),
});

export type EscrowStatus = z.infer<typeof EscrowStatusSchema>;
export type EscrowTransactionType = z.infer<typeof EscrowTransactionTypeSchema>;
export type EscrowTransaction = z.infer<typeof EscrowTransactionSchema>;
export type Escrow = z.infer<typeof EscrowSchema>;
