import { Inject, Injectable } from '@nestjs/common';
import type { FraudAlert, RecommendationQuery, RecommendationSet, SmartPricingSuggestion } from '@tradenest/contracts/ai';
import { AuthorizationService } from '../../common/authorization/index.js';
import { ApiException } from '../../common/http/api-exception.js';
import { ANALYTICS_MODULE_API, type AnalyticsModuleApi } from '../analytics/public/module-api.js';
import type { AuthPrincipal } from '../auth/public/index.js';
import { CATALOG_MODULE_API, type CatalogModuleApi } from '../catalog/public/module-api.js';
import { AiServiceClient } from './ai-service.client.js';
import { catalogFallback } from './recommendation-fallback.js';
import type { AIBridgeModuleApi, PaymentFraudAssessmentSubject } from './public/module-api.js';

const MAX_BEHAVIOR_SIGNALS = 500;
const MAX_CANDIDATE_PRODUCTS = 500;

@Injectable()
export class AIBridgeService implements AIBridgeModuleApi {
  constructor(
    private readonly authorization: AuthorizationService,
    @Inject(ANALYTICS_MODULE_API) private readonly analytics: AnalyticsModuleApi,
    @Inject(CATALOG_MODULE_API) private readonly catalog: CatalogModuleApi,
    private readonly aiService: AiServiceClient,
  ) {}

  async personalized(principal: AuthPrincipal, query: RecommendationQuery): Promise<RecommendationSet> {
    this.authorization.requireRole(principal, ['BUYER']);
    const [events, products] = await Promise.all([
      this.analytics.recentRecommendationEvents(principal.userId, MAX_BEHAVIOR_SIGNALS),
      this.catalog.recommendationCandidates(MAX_CANDIDATE_PRODUCTS),
    ]);
    if (events.length === 0) return catalogFallback(products, query.limit);
    try {
      const response = await this.aiService.personalized({ events, products, limit: query.limit });
      return response.items.length ? response : catalogFallback(products, query.limit);
    } catch (error) {
      if (!this.aiUnavailable(error)) throw error;
      return catalogFallback(products, query.limit);
    }
  }

  async smartPricing(principal: AuthPrincipal, productId: string): Promise<SmartPricingSuggestion> {
    this.authorization.requireRole(principal, ['SELLER']);
    const product = await this.catalog.smartPricingProductContext(principal, productId);
    const [signals, comparables] = await Promise.all([
      this.analytics.smartPricingSignals(product.productId),
      this.catalog.smartPricingComparableProducts(product.categoryId, product.currency, product.productId, 100),
    ]);
    return this.aiService.smartPricing({ product, signals, comparables });
  }

  async smartPricingInsights(principal: AuthPrincipal): Promise<SmartPricingSuggestion[]> {
    this.authorization.requireRole(principal, ['SELLER']);
    const productIds = await this.catalog.sellerPricingProductIds(principal, 10);
    return Promise.all(productIds.map((productId) => this.smartPricing(principal, productId)));
  }

  async similar(productId: string, query: RecommendationQuery): Promise<RecommendationSet> {
    const [target, candidates] = await Promise.all([
      this.catalog.recommendationProductFeature(productId),
      this.catalog.recommendationCandidates(MAX_CANDIDATE_PRODUCTS),
    ]);
    const products = candidates.some((item) => item.productId === target.productId)
      ? candidates
      : [target, ...candidates];
    try {
      const response = await this.aiService.similar({ targetProductId: productId, products, limit: query.limit });
      return response.items.length ? response : catalogFallback(products, query.limit, { targetProductId: productId });
    } catch (error) {
      if (!this.aiUnavailable(error)) throw error;
      return catalogFallback(products, query.limit, { targetProductId: productId });
    }
  }
  /** Only dependency failures can trigger a recommendation-only fallback. */
  private aiUnavailable(error: unknown): boolean {
    return error instanceof ApiException && (error.getStatus() === 502 || error.getStatus() === 503);
  }

  async assessPaymentRisk(subject: PaymentFraudAssessmentSubject): Promise<FraudAlert> {
    const signals = await this.analytics.fraudRiskSignals(subject.userId, subject.paymentId, subject.currency);
    const score = await this.aiService.fraudRisk({
      payment: { amount: subject.amount, currency: subject.currency, outcome: subject.outcome },
      signals,
    });
    return this.analytics.recordFraudAssessment({
      userId: subject.userId,
      orderId: subject.orderId,
      paymentId: subject.paymentId,
    }, score);
  }

}
