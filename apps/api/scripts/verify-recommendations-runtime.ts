import 'dotenv/config';
import { AuthorizationService } from '../src/common/authorization/authorization.service.js';
import { AIBridgeService } from '../src/modules/ai-bridge/ai-bridge.service.js';

const BUYER_ID = '10000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '40000000-0000-4000-8000-000000000001';
const OTHER_PRODUCT_ID = '40000000-0000-4000-8000-000000000002';
const CATEGORY_ID = '50000000-0000-4000-8000-000000000001';

async function main(): Promise<void> {
  const calls: string[] = [];
  const analytics = {
    async recentRecommendationEvents(userId: string, limit: number) {
      if (userId !== BUYER_ID || limit !== 500) throw new Error('Unexpected recommendation-event query.');
      calls.push('events');
      return [{ productId: PRODUCT_ID, eventType: 'PURCHASE' as const, occurredAt: '2026-10-06T00:00:00.000Z' }];
    },
  };
  const catalog = {
    async recommendationCandidates(limit: number) {
      if (limit !== 500) throw new Error('Unexpected recommendation candidate limit.');
      calls.push('candidates');
      return [
        { productId: PRODUCT_ID, categoryId: CATEGORY_ID, name: 'Keyboard', description: 'Mechanical keyboard' },
        { productId: OTHER_PRODUCT_ID, categoryId: CATEGORY_ID, name: 'Keyboard Two', description: 'Gaming keyboard' },
      ];
    },
    async recommendationProductFeature(productId: string) {
      if (productId !== PRODUCT_ID) throw new Error('Unexpected similarity target.');
      calls.push('target');
      return { productId: PRODUCT_ID, categoryId: CATEGORY_ID, name: 'Keyboard', description: 'Mechanical keyboard' };
    },
  };
  const ai = {
    async personalized(input: any) {
      if (input.events.length !== 1 || input.products.length !== 2 || input.limit !== 10) throw new Error('Bad personalized payload.');
      calls.push('personalized-ai');
      return { items: [{ productId: OTHER_PRODUCT_ID, score: 0.8 }], modelVersion: 'recommendation-mvp-v1', generatedAt: '2026-10-06T00:00:00.000Z' };
    },
    async similar(input: any) {
      if (input.targetProductId !== PRODUCT_ID || input.products.length !== 2 || input.limit !== 5) throw new Error('Bad similar payload.');
      calls.push('similar-ai');
      return { items: [{ productId: OTHER_PRODUCT_ID, score: 0.7 }], modelVersion: 'recommendation-mvp-v1', generatedAt: '2026-10-06T00:00:00.000Z' };
    },
  };

  const service = new AIBridgeService(
    new AuthorizationService(),
    analytics as never,
    catalog as never,
    ai as never,
  );
  const principal = {
    userId: BUYER_ID,
    sessionId: '20000000-0000-4000-8000-000000000001',
    email: 'buyer@example.invalid',
    name: 'Buyer',
    role: 'BUYER' as const,
  };

  const personalized = await service.personalized(principal, { limit: 10 });
  if (personalized.items[0]?.productId !== OTHER_PRODUCT_ID) throw new Error('Personalized recommendation result mismatch.');

  const similar = await service.similar(PRODUCT_ID, { limit: 5 });
  if (similar.items[0]?.productId !== OTHER_PRODUCT_ID) throw new Error('Similar-product result mismatch.');

  const expected = ['events', 'candidates', 'personalized-ai', 'target', 'candidates', 'similar-ai'];
  if (calls.join('|') !== expected.join('|')) throw new Error(`Unexpected module-call sequence: ${calls.join('|')}`);

  let forbidden = false;
  try {
    await service.personalized({ ...principal, role: 'SELLER' }, { limit: 10 });
  } catch {
    forbidden = true;
  }
  if (!forbidden) throw new Error('Personalized recommendations must remain Buyer-only.');

  console.log('the implementation RECOMMENDATION RUNTIME VERIFICATION PASSED');
}

await main();
