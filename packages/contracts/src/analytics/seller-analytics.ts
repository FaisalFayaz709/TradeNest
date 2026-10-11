import { z } from 'zod';
import { OrderStatusSchema } from '../orders/order.js';
import { EscrowStatusSchema } from '../escrow/escrow.js';

const CurrencyCodeSchema = z.string().regex(/^[A-Z]{3}$/);
const MoneyAmountSchema = z.string().regex(/^(0|[1-9]\d*)\.\d{2}$/);

export const SellerAnalyticsMoneySchema = z.object({
  currency: CurrencyCodeSchema,
  amount: MoneyAmountSchema,
}).strict();

export const SellerAnalyticsKpisSchema = z.object({
  orderCount: z.number().int().min(0),
  productsSold: z.number().int().min(0),
  conversionRatePercent: z.number().finite().min(0).nullable(),
  revenueByCurrency: z.array(SellerAnalyticsMoneySchema),
  averageOrderValueByCurrency: z.array(SellerAnalyticsMoneySchema),
}).strict();

export const SellerAnalyticsTopProductSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  sku: z.string(),
  unitsSold: z.number().int().min(0),
  revenueByCurrency: z.array(SellerAnalyticsMoneySchema),
}).strict();

export const SellerAnalyticsLowStockProductSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  sku: z.string(),
  availableQuantity: z.number().int().min(0),
  reservedQuantity: z.number().int().min(0),
}).strict();

export const SellerAnalyticsOrderStatusSchema = z.object({
  status: OrderStatusSchema,
  count: z.number().int().min(0),
}).strict();

export const SellerAnalyticsEscrowSchema = z.object({
  status: EscrowStatusSchema,
  currency: CurrencyCodeSchema,
  count: z.number().int().min(0),
  amount: MoneyAmountSchema,
}).strict();

export const SellerAnalyticsSchema = z.object({
  generatedAt: z.string().datetime(),
  lowStockThreshold: z.number().int().min(0),
  kpis: SellerAnalyticsKpisSchema,
  topProducts: z.array(SellerAnalyticsTopProductSchema),
  lowStockProducts: z.array(SellerAnalyticsLowStockProductSchema),
  orderStatusDistribution: z.array(SellerAnalyticsOrderStatusSchema),
  escrowByStatus: z.array(SellerAnalyticsEscrowSchema),
}).strict();

export type SellerAnalytics = z.infer<typeof SellerAnalyticsSchema>;
