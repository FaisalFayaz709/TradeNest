import { z } from 'zod';

/**
 * this contract surface implementation decision for PATCH /products/:id/inventory.
 *
 * Sellers may set only currently available sellable stock. Reserved inventory
 * is backend-owned transactional state and is never client-editable.
 */
export const UpdateInventorySchema = z.object({
  availableQuantity: z.number().int().min(0).max(1_000_000),
}).strict();

export const InventorySchema = z.object({
  productId: z.string().uuid(),
  availableQuantity: z.number().int().min(0),
  reservedQuantity: z.number().int().min(0),
  updatedAt: z.string().datetime(),
});

export type UpdateInventoryInput = z.infer<typeof UpdateInventorySchema>;
export type Inventory = z.infer<typeof InventorySchema>;
