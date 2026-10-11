import { z } from 'zod';

export const AddCartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
}).strict();

export type AddCartItemInput = z.infer<typeof AddCartItemSchema>;

export const UpdateCartItemSchema = z.object({
  quantity: z.number().int().positive(),
}).strict();

export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;

export const CartItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CartItem = z.infer<typeof CartItemSchema>;

export const CartSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  items: z.array(CartItemSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Cart = z.infer<typeof CartSchema>;

export const DeleteCartItemResultSchema = z.object({ deleted: z.literal(true) });
export type DeleteCartItemResult = z.infer<typeof DeleteCartItemResultSchema>;

export const ClearCartResultSchema = z.object({ cleared: z.literal(true) });
export type ClearCartResult = z.infer<typeof ClearCartResultSchema>;
