import { z } from 'zod';

/**
 * this contract surface implementation decision: product updates may change editable catalog
 * fields only. Inventory and lifecycle state have dedicated command endpoints.
 */
export const UpdateProductSchema = z.object({
  name: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(20).max(5000).optional(),
  categoryId: z.string().uuid().optional(),
  price: z.number().positive().max(99_999_999).optional(),
  sku: z.string().trim().min(1).max(100).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one product field must be provided.',
});

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
