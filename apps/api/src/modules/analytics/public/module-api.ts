import type { BehaviorEventReceipt, BehaviorEventType, CreateBehaviorEventInput } from '@tradenest/contracts/analytics';
import type { FraudAlert, FraudAlertQuery, FraudRiskScore } from '@tradenest/contracts/ai';
import type { AuthPrincipal } from '../../auth/public/module-api.js';

export interface SmartPricingSignals {
  productViews: number;
  addToCartEvents: number;
  completedOrders: number;
  completedUnitsSold: number;
}

export interface RecommendationBehaviorSignal {
  productId: string;
  eventType: BehaviorEventType;
  occurredAt: string;
}

export interface FraudRiskSignals {
  failedPayments24h: number;
  paymentAttempts1h: number;
  paymentAttempts24h: number;
  priorSucceededPayments: number;
  distinctIpAddresses24h: number;
  distinctUserAgents24h: number;
  marketP95Amount: string | null;
}

export interface FraudAssessmentSubject {
  userId: string;
  orderId: string;
  paymentId: string;
}

/**
 * Explicit AnalyticsModule inter-module seam.
 *
 * Analytics owns behavior-event persistence, seller analytical read models,
 * and fraud-assessment persistence/read models. It never mutates authoritative
 * marketplace state such as Orders, Payments, Escrow, Catalog or Inventory.
 */
export interface AnalyticsModuleApi {
  ingestBehaviorEvent(
    principal: AuthPrincipal | undefined,
    input: CreateBehaviorEventInput,
  ): Promise<BehaviorEventReceipt>;
  recentRecommendationEvents(userId: string, limit: number): Promise<RecommendationBehaviorSignal[]>;
  smartPricingSignals(productId: string): Promise<SmartPricingSignals>;
  fraudRiskSignals(userId: string, paymentId: string, currency: string): Promise<FraudRiskSignals>;
  recordFraudAssessment(subject: FraudAssessmentSubject, score: FraudRiskScore): Promise<FraudAlert>;
  listFraudAlerts(query: FraudAlertQuery): Promise<FraudAlert[]>;
}

export const ANALYTICS_MODULE_API = Symbol('ANALYTICS_MODULE_API');
