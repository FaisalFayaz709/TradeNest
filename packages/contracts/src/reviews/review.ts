import { z } from 'zod';

export const ReviewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const CreateReviewSchema = z.object({
  orderItemId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().optional(),
});

export const ReviewSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ReviewListQuery = z.infer<typeof ReviewListQuerySchema>;
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
export type Review = z.infer<typeof ReviewSchema>;
