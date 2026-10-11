import { z } from 'zod';

export const OrderStatusSchema = z.enum([
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
  'REFUNDED',
]);

export const OrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const MoneySchema = z.string().regex(/^\d+\.\d{2}$/);

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  sellerId: z.string().uuid(),
  productName: z.string(),
  sku: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: MoneySchema,
  totalPrice: MoneySchema,
  createdAt: z.string().datetime(),
});

/** Immutable shipping-address snapshot written during checkout. */
export const OrderShippingAddressSnapshotSchema = z.object({
  sourceAddressId: z.string().uuid(),
  recipient: z.string(),
  line1: z.string(),
  line2: z.string().nullable(),
  city: z.string(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().length(2),
  phone: z.string().nullable(),
});

export const OrderSummarySchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  buyerId: z.string().uuid(),
  status: OrderStatusSchema,
  currency: z.string().length(3),
  subtotal: MoneySchema,
  shippingAmount: MoneySchema,
  discountAmount: MoneySchema,
  totalAmount: MoneySchema,
  paidAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const OrderSchema = OrderSummarySchema.extend({
  shippingAddress: OrderShippingAddressSnapshotSchema,
  items: z.array(OrderItemSchema),
});

export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type OrderListQuery = z.infer<typeof OrderListQuerySchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type OrderSummary = z.infer<typeof OrderSummarySchema>;
export type Order = z.infer<typeof OrderSchema>;
