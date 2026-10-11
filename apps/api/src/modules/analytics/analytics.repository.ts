import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import type { BehaviorEventType } from '@tradenest/contracts/analytics';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  SellerEscrowRow,
  SellerLowStockProductRow,
  SellerOrderStatusRow,
  SellerProductViewRow,
  SellerProductsSoldRow,
  SellerRevenueRow,
  SellerTopProductRevenueRow,
  SellerTopProductRow,
  SmartPricingSignalRow,
  UserEventRecord,
  FraudRiskSignalRow,
  FraudAssessmentRecord,
} from './analytics.types.js';

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listRecentUserEvents(userId: string, limit: number): Promise<UserEventRecord[]> {
    return this.prisma.userEvent.findMany({
      where: { userId, productId: { not: null } },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }

  /**
   * Purchase intent is derived exclusively from verified payment records.
   * Browsers cannot create PURCHASE behavior events, and old untrusted
   * PURCHASE rows are intentionally excluded from the recommendation feed.
   */
  async verifiedPurchaseSignals(userId: string, limit: number): Promise<Array<{ productId: string; occurredAt: Date }>> {
    return this.prisma.$queryRaw<Array<{ productId: string; occurredAt: Date }>>`
      SELECT oi.product_id AS "productId", COALESCE(o.paid_at, p.paid_at) AS "occurredAt"
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN LATERAL (
        SELECT paid_at
        FROM payments
        WHERE order_id = o.id AND status = 'SUCCEEDED' AND paid_at IS NOT NULL
        ORDER BY paid_at DESC, id DESC LIMIT 1
      ) p ON true
      WHERE o.buyer_id = ${userId}::uuid
        AND o.status NOT IN ('REFUNDED', 'CANCELLED')
      ORDER BY COALESCE(o.paid_at, p.paid_at) DESC, oi.id DESC
      LIMIT ${limit}
    `;
  }

  async createBehaviorEvent(input: {
    userId: string | null;
    productId: string;
    eventType: BehaviorEventType;
  }): Promise<UserEventRecord> {
    return this.prisma.userEvent.create({
      data: {
        userId: input.userId,
        productId: input.productId,
        eventType: input.eventType,
      },
    });
  }

  async smartPricingSignals(productId: string): Promise<SmartPricingSignalRow> {
    const rows = await this.prisma.$queryRaw<SmartPricingSignalRow[]>`
      SELECT
        (SELECT COUNT(*)::int FROM user_events ue WHERE ue.product_id = ${productId}::uuid AND ue.event_type = 'PRODUCT_VIEW') AS "productViews",
        (SELECT COUNT(*)::int FROM user_events ue WHERE ue.product_id = ${productId}::uuid AND ue.event_type = 'ADD_TO_CART') AS "addToCartEvents",
        (SELECT COUNT(DISTINCT oi.order_id)::int
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
          WHERE oi.product_id = ${productId}::uuid AND o.status = 'COMPLETED') AS "completedOrders",
        (SELECT COALESCE(SUM(oi.quantity), 0)::int
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
          WHERE oi.product_id = ${productId}::uuid AND o.status = 'COMPLETED') AS "completedUnitsSold"
    `;
    return rows[0] ?? { productViews: 0, addToCartEvents: 0, completedOrders: 0, completedUnitsSold: 0 };
  }

  /**
   * Read-only cross-domain analytical projection. The Analytics module never
   * mutates Orders/Catalog/Escrow records; those modules remain authoritative
   * for business state and transitions.
   */
  async sellerRevenueByCurrency(sellerId: string): Promise<SellerRevenueRow[]> {
    return this.prisma.$queryRaw<SellerRevenueRow[]>`
      SELECT
        o.currency AS "currency",
        ROUND(SUM(e.amount), 2)::text AS "amount",
        COUNT(*)::int AS "orderCount",
        ROUND(AVG(e.amount), 2)::text AS "averageOrderValue"
      FROM escrows e
      JOIN orders o ON o.id = e.order_id
      WHERE e.status = 'RELEASED'
        AND EXISTS (
          SELECT 1 FROM order_items oi
          WHERE oi.order_id = o.id AND oi.seller_id = ${sellerId}::uuid
        )
      GROUP BY o.currency
      ORDER BY o.currency ASC
    `;
  }

  async sellerProductsSold(sellerId: string): Promise<SellerProductsSoldRow> {
    const rows = await this.prisma.$queryRaw<SellerProductsSoldRow[]>`
      SELECT COALESCE(SUM(oi.quantity), 0)::int AS "productsSold"
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.seller_id = ${sellerId}::uuid
        AND o.status = 'COMPLETED'
    `;
    return rows[0] ?? { productsSold: 0 };
  }

  async sellerOrderStatusDistribution(sellerId: string): Promise<SellerOrderStatusRow[]> {
    return this.prisma.$queryRaw<SellerOrderStatusRow[]>`
      SELECT so.status::text AS "status", COUNT(*)::int AS "count"
      FROM (
        SELECT DISTINCT o.id, o.status
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE oi.seller_id = ${sellerId}::uuid
      ) so
      GROUP BY so.status
      ORDER BY so.status::text ASC
    `;
  }

  async sellerProductViews(sellerId: string): Promise<SellerProductViewRow> {
    const rows = await this.prisma.$queryRaw<SellerProductViewRow[]>`
      SELECT COUNT(*)::int AS "productViews"
      FROM user_events ue
      JOIN products p ON p.id = ue.product_id
      WHERE p.seller_id = ${sellerId}::uuid
        AND ue.event_type = 'PRODUCT_VIEW'
    `;
    return rows[0] ?? { productViews: 0 };
  }

  async sellerTopProducts(sellerId: string, limit: number): Promise<SellerTopProductRow[]> {
    return this.prisma.$queryRaw<SellerTopProductRow[]>`
      SELECT
        oi.product_id AS "productId",
        p.name AS "productName",
        p.sku AS "sku",
        SUM(oi.quantity)::int AS "unitsSold"
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      WHERE oi.seller_id = ${sellerId}::uuid
        AND o.status = 'COMPLETED'
      GROUP BY oi.product_id, p.name, p.sku
      ORDER BY SUM(oi.quantity) DESC, p.name ASC, oi.product_id ASC
      LIMIT ${limit}
    `;
  }

  async sellerTopProductRevenue(sellerId: string): Promise<SellerTopProductRevenueRow[]> {
    return this.prisma.$queryRaw<SellerTopProductRevenueRow[]>`
      SELECT
        oi.product_id AS "productId",
        o.currency AS "currency",
        ROUND(SUM(oi.total_price), 2)::text AS "amount"
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.seller_id = ${sellerId}::uuid
        AND o.status = 'COMPLETED'
      GROUP BY oi.product_id, o.currency
      ORDER BY oi.product_id ASC, o.currency ASC
    `;
  }

  async sellerLowStockProducts(sellerId: string, threshold: number, limit: number): Promise<SellerLowStockProductRow[]> {
    return this.prisma.$queryRaw<SellerLowStockProductRow[]>`
      SELECT
        p.id AS "productId",
        p.name AS "productName",
        p.sku AS "sku",
        i.available_quantity AS "availableQuantity",
        i.reserved_quantity AS "reservedQuantity"
      FROM products p
      JOIN inventory i ON i.product_id = p.id
      WHERE p.seller_id = ${sellerId}::uuid
        AND p.status = 'ACTIVE'
        AND i.available_quantity <= ${threshold}
      ORDER BY i.available_quantity ASC, p.name ASC, p.id ASC
      LIMIT ${limit}
    `;
  }

  async sellerEscrowByStatus(sellerId: string): Promise<SellerEscrowRow[]> {
    return this.prisma.$queryRaw<SellerEscrowRow[]>`
      SELECT
        e.status::text AS "status",
        o.currency AS "currency",
        COUNT(*)::int AS "count",
        ROUND(SUM(e.amount), 2)::text AS "amount"
      FROM escrows e
      JOIN orders o ON o.id = e.order_id
      WHERE EXISTS (
        SELECT 1 FROM order_items oi
        WHERE oi.order_id = o.id AND oi.seller_id = ${sellerId}::uuid
      )
      GROUP BY e.status, o.currency
      ORDER BY e.status::text ASC, o.currency ASC
    `;
  }
  async fraudRiskSignals(userId: string, paymentId: string, currency: string): Promise<FraudRiskSignalRow> {
    const rows = await this.prisma.$queryRaw<FraudRiskSignalRow[]>`
      SELECT
        (SELECT COUNT(*)::int
           FROM payments p
          WHERE p.buyer_id = ${userId}::uuid
            AND p.status = 'FAILED'
            AND p.updated_at >= NOW() - INTERVAL '24 hours') AS "failedPayments24h",
        (SELECT COUNT(*)::int
           FROM payments p
          WHERE p.buyer_id = ${userId}::uuid
            AND p.created_at >= NOW() - INTERVAL '1 hour') AS "paymentAttempts1h",
        (SELECT COUNT(*)::int
           FROM payments p
          WHERE p.buyer_id = ${userId}::uuid
            AND p.created_at >= NOW() - INTERVAL '24 hours') AS "paymentAttempts24h",
        (SELECT COUNT(*)::int
           FROM payments p
          WHERE p.buyer_id = ${userId}::uuid
            AND p.status = 'SUCCEEDED'
            AND p.id <> ${paymentId}::uuid) AS "priorSucceededPayments",
        (SELECT COUNT(DISTINCT us.ip_address)::int
           FROM user_sessions us
          WHERE us.user_id = ${userId}::uuid
            AND us.ip_address IS NOT NULL
            AND us.created_at >= NOW() - INTERVAL '24 hours') AS "distinctIpAddresses24h",
        (SELECT COUNT(DISTINCT us.user_agent)::int
           FROM user_sessions us
          WHERE us.user_id = ${userId}::uuid
            AND us.user_agent IS NOT NULL
            AND us.created_at >= NOW() - INTERVAL '24 hours') AS "distinctUserAgents24h",
        (SELECT ROUND(percentile_disc(0.95) WITHIN GROUP (ORDER BY p.amount), 2)::text
           FROM payments p
          WHERE p.status = 'SUCCEEDED'
            AND p.currency = ${currency}
            AND p.id <> ${paymentId}::uuid) AS "marketP95Amount"
    `;
    return rows[0] ?? {
      failedPayments24h: 0,
      paymentAttempts1h: 0,
      paymentAttempts24h: 0,
      priorSucceededPayments: 0,
      distinctIpAddresses24h: 0,
      distinctUserAgents24h: 0,
      marketP95Amount: null,
    };
  }

  async createFraudAssessmentOnce(input: {
    userId: string;
    orderId: string;
    paymentId: string;
    riskScore: number;
    riskLevel: string;
    reasons: unknown;
    modelVersion: string;
  }): Promise<FraudAssessmentRecord> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.paymentId}::text, 0::bigint))`;
      const existing = await transaction.fraudAssessment.findFirst({
        where: { paymentId: input.paymentId, modelVersion: input.modelVersion },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      if (existing) return existing as FraudAssessmentRecord;

      return transaction.fraudAssessment.create({
        data: {
          userId: input.userId,
          orderId: input.orderId,
          paymentId: input.paymentId,
          riskScore: input.riskScore.toFixed(4),
          riskLevel: input.riskLevel,
          reasons: input.reasons as Prisma.InputJsonValue,
          modelVersion: input.modelVersion,
        },
      }) as Promise<FraudAssessmentRecord>;
    });
  }

  async listFraudAssessments(input: { riskLevel?: string; limit: number }): Promise<FraudAssessmentRecord[]> {
    return this.prisma.fraudAssessment.findMany({
      ...(input.riskLevel !== undefined ? { where: { riskLevel: input.riskLevel } } : {}),
      orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit,
    }) as Promise<FraudAssessmentRecord[]>;
  }

}
