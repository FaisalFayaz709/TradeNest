import type { BehaviorEventType } from '@tradenest/contracts/analytics';
import type { EscrowStatus } from '@tradenest/contracts/escrow';
import type { OrderStatus } from '@tradenest/contracts/orders';

export interface UserEventRecord {
  id: string;
  userId: string | null;
  productId: string | null;
  eventType: BehaviorEventType;
  metadata: unknown | null;
  occurredAt: Date;
}

export interface SellerRevenueRow {
  currency: string;
  amount: string;
  orderCount: number;
  averageOrderValue: string;
}

export interface SellerProductsSoldRow {
  productsSold: number;
}

export interface SellerOrderStatusRow {
  status: OrderStatus;
  count: number;
}

export interface SellerProductViewRow {
  productViews: number;
}

export interface SellerTopProductRow {
  productId: string;
  productName: string;
  sku: string;
  unitsSold: number;
}

export interface SellerTopProductRevenueRow {
  productId: string;
  currency: string;
  amount: string;
}

export interface SellerLowStockProductRow {
  productId: string;
  productName: string;
  sku: string;
  availableQuantity: number;
  reservedQuantity: number;
}

export interface SellerEscrowRow {
  status: EscrowStatus;
  currency: string;
  count: number;
  amount: string;
}


export interface SmartPricingSignalRow {
  productViews: number;
  addToCartEvents: number;
  completedOrders: number;
  completedUnitsSold: number;
}

export interface FraudRiskSignalRow {
  failedPayments24h: number;
  paymentAttempts1h: number;
  paymentAttempts24h: number;
  priorSucceededPayments: number;
  distinctIpAddresses24h: number;
  distinctUserAgents24h: number;
  marketP95Amount: string | null;
}

export interface FraudAssessmentRecord {
  id: string;
  userId: string | null;
  orderId: string | null;
  paymentId: string | null;
  riskScore: { toString(): string };
  riskLevel: string;
  reasons: unknown;
  modelVersion: string;
  createdAt: Date;
}
