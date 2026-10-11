import { z } from 'zod';

/**
 * Locked CreateProduct contract copied from TradeNest Technical Blueprint §10.1.
 */
export const CreateProductSchema = z.object({
  name: z.string().trim().min(3).max(200),
  description: z.string().trim().min(20).max(5000),
  categoryId: z.string().uuid(),
  price: z.number().positive().max(99_999_999),
  stock: z.number().int().min(0).max(1_000_000),
  sku: z.string().trim().min(1).max(100),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
