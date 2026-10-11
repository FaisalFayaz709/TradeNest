import { z } from 'zod';

export const RecommendationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();
export type RecommendationQuery = z.infer<typeof RecommendationQuerySchema>;

export const RecommendationItemSchema = z.object({
  productId: z.string().uuid(),
  score: z.number().finite().min(0).max(1),
}).strict();
export type RecommendationItem = z.infer<typeof RecommendationItemSchema>;

export const RecommendationSetSchema = z.object({
  items: z.array(RecommendationItemSchema).max(50),
  modelVersion: z.string().trim().min(1).max(128),
  generatedAt: z.string().datetime(),
}).strict();
export type RecommendationSet = z.infer<typeof RecommendationSetSchema>;
