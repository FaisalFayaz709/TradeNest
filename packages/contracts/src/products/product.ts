import { z } from 'zod';

export const ProductStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED', 'SUSPENDED']);

export const ProductImageSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  objectKey: z.string(),
  url: z.union([
    z.string().url(),
    z.string().regex(/^\/api\/tradenest\/products\/[0-9a-f-]{36}\/images\/[0-9a-f-]{36}\/file$/),
  ]),
  sortOrder: z.number().int(),
  isPrimary: z.boolean(),
  createdAt: z.string().datetime(),
});

export const ProductSchema = z.object({
  id: z.string().uuid(),
  sellerId: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  /** Decimal string: authoritative money must not depend on JS binary floating point. */
  price: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  sku: z.string(),
  status: ProductStatusSchema,
  availableQuantity: z.number().int().min(0),
  images: z.array(ProductImageSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProductStatus = z.infer<typeof ProductStatusSchema>;
export type ProductImage = z.infer<typeof ProductImageSchema>;
export type Product = z.infer<typeof ProductSchema>;
