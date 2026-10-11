import { z } from 'zod';

export const BehaviorEventTypeSchema = z.enum([
  'PRODUCT_VIEW',
  'WISHLIST',
  'ADD_TO_CART',
  'PURCHASE',
]);
export type BehaviorEventType = z.infer<typeof BehaviorEventTypeSchema>;

export const CreateBehaviorEventSchema = z.object({
  eventType: BehaviorEventTypeSchema,
  productId: z.string().uuid(),
}).strict();
export type CreateBehaviorEventInput = z.infer<typeof CreateBehaviorEventSchema>;

export const BehaviorEventReceiptSchema = z.object({
  id: z.string().uuid(),
  eventType: BehaviorEventTypeSchema,
  productId: z.string().uuid(),
  occurredAt: z.string().datetime(),
}).strict();
export type BehaviorEventReceipt = z.infer<typeof BehaviorEventReceiptSchema>;
