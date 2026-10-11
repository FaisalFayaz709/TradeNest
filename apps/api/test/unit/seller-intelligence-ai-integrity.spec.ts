import { jest } from '@jest/globals';
import { ApiException } from '../../src/common/http/api-exception.js';
import { AuthorizationService } from '../../src/common/authorization/authorization.service.js';
import { AIBridgeService } from '../../src/modules/ai-bridge/ai-bridge.service.js';
import { AnalyticsService } from '../../src/modules/analytics/analytics.service.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://tradenest:tradenest@127.0.0.1:5432/tradenest_e2e?schema=public';
process.env.CATALOG_DEFAULT_CURRENCY ??= 'USD';
process.env.JWT_ACCESS_SECRET ??= 'seller intelligence-test-jwt-secret-long-enough-for-testing';
process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET ??= 'seller intelligence-test-sandbox-secret-long-enough';

const buyer = { userId: '10000000-0000-4000-8000-000000000001', role: 'BUYER' as const,
  sessionId: '10000000-0000-4000-8000-000000000002', email: 'buyer@example.invalid', name: 'Buyer' };
const itemA = { productId: '10000000-0000-4000-8000-000000000010', categoryId: '20000000-0000-4000-8000-000000000010', name: 'Keyboard', description: 'Mechanical keyboard' };
const itemB = { productId: '10000000-0000-4000-8000-000000000011', categoryId: '20000000-0000-4000-8000-000000000010', name: 'Mouse', description: 'Wireless mouse' };
const time = new Date('2026-10-08T08:00:00.000Z');

function bridge(behavior: unknown[], ai: object) {
  return new AIBridgeService(
    new AuthorizationService(),
    { recentRecommendationEvents: jest.fn().mockResolvedValue(behavior) } as never,
    {
      recommendationCandidates: jest.fn().mockResolvedValue([itemA, itemB]),
      recommendationProductFeature: jest.fn().mockResolvedValue(itemA),
    } as never,
    ai as never,
  );
}

describe('Seller intelligence - AI recommendation safety', () => {
  it('returns a truthful catalog-only fallback for a buyer without events', async () => {
    const ai = { personalized: jest.fn() };
    const result = await bridge([], ai).personalized(buyer, { limit: 1 });
    expect(result.modelVersion).toBe('catalog-fallback-v1');
    expect(result.items).toHaveLength(1);
    expect(ai.personalized).not.toHaveBeenCalled();
  });

  it('degrades on an internal 503 but not on an unrelated authorization error', async () => {
    const unavailable = bridge([{ productId: itemA.productId, eventType: 'PRODUCT_VIEW', occurredAt: time.toISOString() }], {
      personalized: jest.fn().mockRejectedValue(new ApiException(503, { code: 'AI_SERVICE_UNAVAILABLE', message: 'Unavailable' })),
    });
    expect((await unavailable.personalized(buyer, { limit: 2 })).modelVersion).toBe('catalog-fallback-v1');
    const forbidden = bridge([{ productId: itemA.productId, eventType: 'PRODUCT_VIEW', occurredAt: time.toISOString() }], {
      personalized: jest.fn().mockRejectedValue(new ApiException(403, { code: 'FORBIDDEN', message: 'No' })),
    });
    await expect(forbidden.personalized(buyer, { limit: 2 })).rejects.toMatchObject({ status: 403 });
  });

  it('does not permit a Seller to fetch a Buyer personalization feed', async () => {
    await expect(bridge([], {}).personalized({ ...buyer, role: 'SELLER' }, { limit: 3 })).rejects.toBeInstanceOf(ApiException);
  });
});

describe('Seller intelligence - trusted purchase signals', () => {
  const mockRepo = () => ({
    createBehaviorEvent: jest.fn().mockResolvedValue({ id: '30000000-0000-4000-8000-000000000001',
      productId: itemA.productId, eventType: 'PRODUCT_VIEW', occurredAt: time, userId: buyer.userId }),
    listRecentUserEvents: jest.fn().mockResolvedValue([
      { productId: itemA.productId, eventType: 'PURCHASE', occurredAt: time },
      { productId: itemA.productId, eventType: 'PRODUCT_VIEW', occurredAt: time },
    ]),
    verifiedPurchaseSignals: jest.fn().mockResolvedValue([
      { productId: itemB.productId, occurredAt: new Date('2026-10-08T09:00:00.000Z') },
    ]),
  });

  it('rejects browser-submitted PURCHASE signals without database writes', async () => {
    const repo = mockRepo();
    const service = new AnalyticsService(repo as never, new AuthorizationService(), {} as never, {} as never);
    await expect(service.ingestBehaviorEvent(buyer, { eventType: 'PURCHASE', productId: itemA.productId }))
      .rejects.toMatchObject({ status: 403 });
    expect(repo.createBehaviorEvent).not.toHaveBeenCalled();
  });

  it('uses only verified payment purchases, dropping untrusted historical purchase rows', async () => {
    const repo = mockRepo();
    const service = new AnalyticsService(repo as never, new AuthorizationService(), {} as never, {} as never);
    const events = await service.recentRecommendationEvents(buyer.userId, 10);
    expect(events.map((event) => event.eventType)).toEqual(['PURCHASE', 'PRODUCT_VIEW']);
    expect(events[0].productId).toBe(itemB.productId);
  });
});
