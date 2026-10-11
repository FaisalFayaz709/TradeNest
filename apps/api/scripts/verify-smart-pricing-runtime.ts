import 'dotenv/config';
import { AuthorizationService } from '../src/common/authorization/authorization.service.js';
import { AIBridgeService } from '../src/modules/ai-bridge/ai-bridge.service.js';

const SELLER_ID = '10000000-0000-4000-8000-000000000010';
const PRODUCT_ID = '40000000-0000-4000-8000-000000000010';
const CATEGORY_ID = '50000000-0000-4000-8000-000000000010';

async function main(): Promise<void> {
  const calls: string[] = [];
  const analytics = {
    async smartPricingSignals(productId: string) {
      if (productId !== PRODUCT_ID) throw new Error('Unexpected pricing signal product.');
      calls.push('signals');
      return { productViews: 100, addToCartEvents: 10, completedOrders: 5, completedUnitsSold: 8 };
    },
  };
  const catalog = {
    async smartPricingProductContext(principal: any, productId: string) {
      if (principal.userId !== SELLER_ID || productId !== PRODUCT_ID) throw new Error('Ownership context mismatch.');
      calls.push('context');
      return { productId: PRODUCT_ID, sellerId: SELLER_ID, categoryId: CATEGORY_ID, currentPrice: '100.00', currency: 'USD' };
    },
    async smartPricingComparableProducts(categoryId: string, currency: string, excludeProductId: string, limit: number) {
      if (categoryId !== CATEGORY_ID || currency !== 'USD' || excludeProductId !== PRODUCT_ID || limit !== 100) throw new Error('Comparable query mismatch.');
      calls.push('comparables');
      return [{ productId: '40000000-0000-4000-8000-000000000011', price: '110.00', currency: 'USD' }];
    },
  };
  const ai = {
    async smartPricing(input: any) {
      if (input.product.productId !== PRODUCT_ID || input.signals.productViews !== 100 || input.comparables.length !== 1) throw new Error('Bad smart-pricing payload.');
      calls.push('pricing-ai');
      return {
        productId: PRODUCT_ID,
        currency: 'USD',
        currentPrice: '100.00',
        suggestedRange: { minPrice: '95.00', maxPrice: '115.00' },
        signals: { productViews: 100, addToCartEvents: 10, completedOrders: 5, completedUnitsSold: 8, conversionRatePercent: 5, comparableProductCount: 1, comparableMedianPrice: '110.00' },
        advisory: true,
        modelVersion: 'smart-pricing-mvp-v1',
        generatedAt: '2026-10-06T00:00:00.000Z',
      };
    },
  };

  const service = new AIBridgeService(new AuthorizationService(), analytics as never, catalog as never, ai as never);
  const principal = { userId: SELLER_ID, sessionId: '20000000-0000-4000-8000-000000000010', email: 'seller@example.invalid', name: 'Seller', role: 'SELLER' as const };
  const result = await service.smartPricing(principal, PRODUCT_ID);
  if (!result.advisory || result.productId !== PRODUCT_ID) throw new Error('Pricing suggestion result mismatch.');
  if (calls.join('|') !== 'context|signals|comparables|pricing-ai') throw new Error(`Unexpected call sequence: ${calls.join('|')}`);

  let forbidden = false;
  try { await service.smartPricing({ ...principal, role: 'BUYER' }, PRODUCT_ID); } catch { forbidden = true; }
  if (!forbidden) throw new Error('Smart pricing must remain Seller-only.');

  console.log('the implementation SMART PRICING RUNTIME VERIFICATION PASSED');
}

await main();
