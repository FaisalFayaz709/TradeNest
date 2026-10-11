import { z } from 'zod';

const DecimalMoneySchema = z.string().regex(/^\d{1,8}\.\d{2}$/);

export const SmartPricingSuggestionSchema = z.object({
  productId: z.string().uuid(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  currentPrice: DecimalMoneySchema,
  suggestedRange: z.object({
    minPrice: DecimalMoneySchema,
    maxPrice: DecimalMoneySchema,
  }).strict(),
  signals: z.object({
    productViews: z.number().int().nonnegative(),
    addToCartEvents: z.number().int().nonnegative(),
    completedOrders: z.number().int().nonnegative(),
    completedUnitsSold: z.number().int().nonnegative(),
    conversionRatePercent: z.number().finite().min(0).max(100).nullable(),
    comparableProductCount: z.number().int().nonnegative(),
    comparableMedianPrice: DecimalMoneySchema.nullable(),
  }).strict(),
  advisory: z.literal(true),
  modelVersion: z.string().trim().min(1).max(128),
  generatedAt: z.string().datetime(),
}).strict();
export type SmartPricingSuggestion = z.infer<typeof SmartPricingSuggestionSchema>;
