import type { FraudAlert, RecommendationQuery, RecommendationSet, SmartPricingSuggestion } from '@tradenest/contracts/ai';
import type { AuthPrincipal } from '../../auth/public/module-api.js';

export interface PaymentFraudAssessmentSubject {
  userId: string;
  orderId: string;
  paymentId: string;
  amount: string;
  currency: string;
  outcome: 'SUCCEEDED' | 'FAILED';
  occurredAt: string;
}

/**
 * Public inter-module contract for AIBridgeModule.
 *
 * AI outputs are advisory/read-oriented. The bridge may score payment-risk
 * telemetry, but it has no authority to mutate payment/order/escrow state.
 */
export interface AIBridgeModuleApi {
  personalized(principal: AuthPrincipal, query: RecommendationQuery): Promise<RecommendationSet>;
  similar(productId: string, query: RecommendationQuery): Promise<RecommendationSet>;
  smartPricing(principal: AuthPrincipal, productId: string): Promise<SmartPricingSuggestion>;
  smartPricingInsights(principal: AuthPrincipal): Promise<SmartPricingSuggestion[]>;
  assessPaymentRisk(subject: PaymentFraudAssessmentSubject): Promise<FraudAlert>;
}

export const A_I_BRIDGE_MODULE_API = Symbol('A_I_BRIDGE_MODULE_API');
