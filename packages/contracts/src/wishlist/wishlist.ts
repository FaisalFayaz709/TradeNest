import { z } from 'zod';

export const WishlistItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export const DeleteWishlistItemResultSchema = z.object({
  deleted: z.literal(true),
  productId: z.string().uuid(),
});

export type WishlistItem = z.infer<typeof WishlistItemSchema>;
export type DeleteWishlistItemResult = z.infer<typeof DeleteWishlistItemResultSchema>;
