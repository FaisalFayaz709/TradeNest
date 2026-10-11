import { z } from 'zod';

const MoneyAmountSchema = z.string().regex(/^(0|[1-9]\d*)\.\d{2}$/);

export const CheckoutQuoteItemSchema = z.object({
  productId: z.string().uuid(),
  sellerId: z.string().uuid(),
  productName: z.string().min(1),
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: MoneyAmountSchema,
  lineTotal: MoneyAmountSchema,
}).strict();

export type CheckoutQuoteItem = z.infer<typeof CheckoutQuoteItemSchema>;

export const CheckoutQuoteSchema = z.object({
  cartId: z.string().uuid(),
  sellerId: z.string().uuid(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  items: z.array(CheckoutQuoteItemSchema).min(1),
  subtotalAmount: MoneyAmountSchema,
  shippingAmount: MoneyAmountSchema,
  discountAmount: MoneyAmountSchema,
  totalAmount: MoneyAmountSchema,
  inventoryReserved: z.literal(false),
}).strict();

export type CheckoutQuote = z.infer<typeof CheckoutQuoteSchema>;
