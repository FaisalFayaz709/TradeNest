import { z } from 'zod';
import { FinancialIdempotencyKeySchema } from '../common/idempotency.js';

const MoneyAmountSchema = z.string().regex(/^(0|[1-9]\d*)\.\d{2}$/);

export const CheckoutIdempotencyKeySchema = FinancialIdempotencyKeySchema;
export type CheckoutIdempotencyKey = z.infer<typeof CheckoutIdempotencyKeySchema>;

export const CreateCheckoutSchema = z.object({
  shippingAddressId: z.string().uuid(),
}).strict();
export type CreateCheckoutInput = z.infer<typeof CreateCheckoutSchema>;

export const CheckoutOrderItemSchema = z.object({
  productId: z.string().uuid(),
  sellerId: z.string().uuid(),
  productName: z.string().min(1),
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: MoneyAmountSchema,
  totalPrice: MoneyAmountSchema,
}).strict();
export type CheckoutOrderItem = z.infer<typeof CheckoutOrderItemSchema>;

export const CheckoutCreatedSchema = z.object({
  order: z.object({
    id: z.string().uuid(),
    orderNumber: z.string().min(1),
    status: z.literal('PENDING_PAYMENT'),
    currency: z.string().regex(/^[A-Z]{3}$/),
    subtotalAmount: MoneyAmountSchema,
    shippingAmount: MoneyAmountSchema,
    discountAmount: MoneyAmountSchema,
    totalAmount: MoneyAmountSchema,
    items: z.array(CheckoutOrderItemSchema).min(1),
  }).strict(),
  payment: z.object({
    id: z.string().uuid(),
    status: z.literal('PENDING'),
    amount: MoneyAmountSchema,
    currency: z.string().regex(/^[A-Z]{3}$/),
  }).strict(),
  inventoryReserved: z.literal(true),
  cartClosed: z.literal(true),
}).strict();
export type CheckoutCreated = z.infer<typeof CheckoutCreatedSchema>;
