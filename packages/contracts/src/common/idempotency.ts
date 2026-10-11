import { z } from 'zod';

/** Shared transport boundary for financial Idempotency-Key headers. */
export const FinancialIdempotencyKeySchema = z.string().trim().min(8).max(200);
export type FinancialIdempotencyKey = z.infer<typeof FinancialIdempotencyKeySchema>;
