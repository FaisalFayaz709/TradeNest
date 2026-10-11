import { z } from 'zod';
import { ProductStatusSchema } from './product.js';

export const ProductQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  categoryId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const SellerProductQuerySchema = ProductQuerySchema.extend({
  status: ProductStatusSchema.optional(),
});

export type ProductQuery = z.infer<typeof ProductQuerySchema>;
export type SellerProductQuery = z.infer<typeof SellerProductQuerySchema>;
