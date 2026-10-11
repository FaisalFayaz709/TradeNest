import { Inject, Injectable } from '@nestjs/common';
import {
  BehaviorEventReceiptSchema,
  SellerAnalyticsSchema,
  type BehaviorEventReceipt,
  type CreateBehaviorEventInput,
  type SellerAnalytics,
} from '@tradenest/contracts/analytics';
import { FraudAlertSchema, type FraudAlert, type FraudAlertQuery, type FraudRiskScore } from '@tradenest/contracts/ai';
import { parseApiEnvironment } from '@tradenest/config';
import { AuthorizationService } from '../../common/authorization/index.js';
import { ApiException } from '../../common/http/api-exception.js';
import type { AuthPrincipal } from '../auth/public/index.js';
import { CATALOG_MODULE_API, type CatalogModuleApi } from '../catalog/public/module-api.js';
import { SELLER_MODULE_API, type SellerModuleApi } from '../seller/public/module-api.js';
import { AnalyticsRepository } from './analytics.repository.js';
import type { AnalyticsModuleApi, FraudAssessmentSubject, FraudRiskSignals, RecommendationBehaviorSignal } from './public/module-api.js';

const TOP_PRODUCT_LIMIT = 5;
const LOW_STOCK_PRODUCT_LIMIT = 20;

@Injectable()
export class AnalyticsService implements AnalyticsModuleApi {
  private readonly lowStockThreshold = parseApiEnvironment(process.env).SELLER_ANALYTICS_LOW_STOCK_THRESHOLD;

  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly authorization: AuthorizationService,
    @Inject(CATALOG_MODULE_API) private readonly catalog: CatalogModuleApi,
    @Inject(SELLER_MODULE_API) private readonly sellers: SellerModuleApi,
  ) {}

  async recentRecommendationEvents(userId: string, limit: number): Promise<RecommendationBehaviorSignal[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
    const [events, purchases] = await Promise.all([
      this.repository.listRecentUserEvents(userId, safeLimit),
      this.repository.verifiedPurchaseSignals(userId, safeLimit),
    ]);
    const acceptedEvents: RecommendationBehaviorSignal[] = events.flatMap((row) =>
      row.productId && row.eventType !== 'PURCHASE'
        ? [{ productId: row.productId, eventType: row.eventType, occurredAt: row.occurredAt.toISOString() }]
        : [],
    );
    const verifiedPurchases: RecommendationBehaviorSignal[] = purchases.map((row) => ({
      productId: row.productId,
      eventType: 'PURCHASE',
      occurredAt: row.occurredAt.toISOString(),
    }));
    return [...acceptedEvents, ...verifiedPurchases]
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.productId.localeCompare(b.productId))
      .slice(0, safeLimit);
  }

  async smartPricingSignals(productId: string) {
    const row = await this.repository.smartPricingSignals(productId);
    return {
      productViews: row.productViews,
      addToCartEvents: row.addToCartEvents,
      completedOrders: row.completedOrders,
      completedUnitsSold: row.completedUnitsSold,
    };
  }

  async ingestBehaviorEvent(
    principal: AuthPrincipal | undefined,
    input: CreateBehaviorEventInput,
  ): Promise<BehaviorEventReceipt> {
    if (input.eventType === 'PURCHASE') {
      throw new ApiException(403, {
        code: 'PURCHASE_EVENT_REQUIRES_VERIFIED_PAYMENT',
        message: 'Purchase signals are derived from provider-verified orders, not client events.',
      });
    }
    await this.catalog.requireBehaviorEventProduct(input.productId);
    const row = await this.repository.createBehaviorEvent({
      userId: principal?.userId ?? null,
      productId: input.productId,
      eventType: input.eventType,
    });
    return BehaviorEventReceiptSchema.parse({
      id: row.id,
      eventType: row.eventType,
      productId: row.productId,
      occurredAt: row.occurredAt.toISOString(),
    });
  }

  async sellerAnalytics(principal: AuthPrincipal): Promise<SellerAnalytics> {
    this.authorization.requireRole(principal, ['SELLER']);
    await this.sellers.requireSellerProfile(principal.userId);

    const [revenue, sold, statuses, views, topProducts, topProductRevenue, lowStockProducts, escrowByStatus] =
      await Promise.all([
        this.repository.sellerRevenueByCurrency(principal.userId),
        this.repository.sellerProductsSold(principal.userId),
        this.repository.sellerOrderStatusDistribution(principal.userId),
        this.repository.sellerProductViews(principal.userId),
        this.repository.sellerTopProducts(principal.userId, TOP_PRODUCT_LIMIT),
        this.repository.sellerTopProductRevenue(principal.userId),
        this.repository.sellerLowStockProducts(
          principal.userId,
          this.lowStockThreshold,
          LOW_STOCK_PRODUCT_LIMIT,
        ),
        this.repository.sellerEscrowByStatus(principal.userId),
      ]);

    const completedOrderCount = statuses.find((row) => row.status === 'COMPLETED')?.count ?? 0;
    const orderCount = statuses.reduce((total, row) => total + row.count, 0);
    const conversionRatePercent =
      views.productViews === 0
        ? null
        : Math.round((completedOrderCount / views.productViews) * 10_000) / 100;

    const revenueByProduct = new Map<string, Array<{ currency: string; amount: string }>>();
    for (const row of topProductRevenue) {
      const values = revenueByProduct.get(row.productId) ?? [];
      values.push({ currency: row.currency, amount: row.amount });
      revenueByProduct.set(row.productId, values);
    }

    return SellerAnalyticsSchema.parse({
      generatedAt: new Date().toISOString(),
      lowStockThreshold: this.lowStockThreshold,
      kpis: {
        orderCount,
        productsSold: sold.productsSold,
        conversionRatePercent,
        revenueByCurrency: revenue.map((row) => ({ currency: row.currency, amount: row.amount })),
        averageOrderValueByCurrency: revenue.map((row) => ({
          currency: row.currency,
          amount: row.averageOrderValue,
        })),
      },
      topProducts: topProducts.map((row) => ({
        productId: row.productId,
        productName: row.productName,
        sku: row.sku,
        unitsSold: row.unitsSold,
        revenueByCurrency: revenueByProduct.get(row.productId) ?? [],
      })),
      lowStockProducts,
      orderStatusDistribution: statuses,
      escrowByStatus,
    });
  }
  async fraudRiskSignals(userId: string, paymentId: string, currency: string): Promise<FraudRiskSignals> {
    const row = await this.repository.fraudRiskSignals(userId, paymentId, currency);
    return {
      failedPayments24h: row.failedPayments24h,
      paymentAttempts1h: row.paymentAttempts1h,
      paymentAttempts24h: row.paymentAttempts24h,
      priorSucceededPayments: row.priorSucceededPayments,
      distinctIpAddresses24h: row.distinctIpAddresses24h,
      distinctUserAgents24h: row.distinctUserAgents24h,
      marketP95Amount: row.marketP95Amount,
    };
  }

  async recordFraudAssessment(subject: FraudAssessmentSubject, score: FraudRiskScore): Promise<FraudAlert> {
    const row = await this.repository.createFraudAssessmentOnce({
      ...subject,
      riskScore: score.riskScore,
      riskLevel: score.riskLevel,
      reasons: score.reasons,
      modelVersion: score.modelVersion,
    });
    return this.mapFraudAlert(row);
  }

  async listFraudAlerts(query: FraudAlertQuery): Promise<FraudAlert[]> {
    const rows = await this.repository.listFraudAssessments({ ...(query.riskLevel !== undefined ? { riskLevel: query.riskLevel } : {}), limit: query.limit });
    return rows.map((row) => this.mapFraudAlert(row));
  }

  private mapFraudAlert(row: {
    id: string;
    userId: string | null;
    orderId: string | null;
    paymentId: string | null;
    riskScore: { toString(): string };
    riskLevel: string;
    reasons: unknown;
    modelVersion: string;
    createdAt: Date;
  }): FraudAlert {
    return FraudAlertSchema.parse({
      id: row.id,
      userId: row.userId,
      orderId: row.orderId,
      paymentId: row.paymentId,
      riskScore: Number(row.riskScore.toString()),
      riskLevel: row.riskLevel,
      reasons: row.reasons,
      reviewRecommended: row.riskLevel === 'HIGH',
      modelVersion: row.modelVersion,
      createdAt: row.createdAt.toISOString(),
    });
  }

}
