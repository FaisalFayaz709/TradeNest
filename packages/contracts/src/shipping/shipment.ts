import { z } from 'zod';

export const CreateShipmentSchema = z.object({
  carrier: z.string().trim().min(1).max(120),
  trackingCode: z.string().trim().min(1).max(255),
});

export const ShipmentStatusSchema = z.enum(['SHIPPED', 'DELIVERED']);

export const ShipmentSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  carrier: z.string(),
  trackingCode: z.string(),
  status: ShipmentStatusSchema,
  shippedAt: z.string().datetime(),
  deliveredAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreateShipmentInput = z.infer<typeof CreateShipmentSchema>;
export type ShipmentStatus = z.infer<typeof ShipmentStatusSchema>;
export type Shipment = z.infer<typeof ShipmentSchema>;
