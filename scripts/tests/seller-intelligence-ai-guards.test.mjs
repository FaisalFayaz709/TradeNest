import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const source = (name) => readFileSync(resolve(root, name), 'utf8');
const { catalogFallback } = await import(pathToFileURL(resolve(root, 'apps/api/src/modules/ai-bridge/recommendation-fallback.ts')).href);
const products = [
  { productId: '10000000-0000-4000-8000-000000000001', categoryId: '20000000-0000-4000-8000-000000000001', name: 'Keyboard', description: 'mechanical' },
  { productId: '10000000-0000-4000-8000-000000000002', categoryId: '20000000-0000-4000-8000-000000000002', name: 'Mug', description: 'ceramic' },
  { productId: '10000000-0000-4000-8000-000000000003', categoryId: '20000000-0000-4000-8000-000000000001', name: 'Mouse', description: 'wireless' },
];

test('fallback catalog mode is bounded, deterministic, labeled and never claims a trained model', () => {
  const result = catalogFallback([...products, products[0]], 2);
  assert.equal(result.modelVersion, 'catalog-fallback-v1');
  assert.deepEqual(result.items.map(x => x.productId), products.slice(0, 2).map(x => x.productId));
  assert.equal(new Set(result.items.map(x => x.productId)).size, 2);
  assert.equal(result.items.every(x => x.score >= 0 && x.score <= 1), true);
});

test('similarity fallback excludes target and prefers its own category', () => {
  const result = catalogFallback(products, 3, { targetProductId: products[0].productId });
  assert.deepEqual(result.items.map(x => x.productId), [products[2].productId, products[1].productId]);
  assert.ok(result.items[0].score > result.items[1].score);
});

test('client cannot forge PURCHASE events, and historic client rows do not count as purchases', () => {
  const service = source('apps/api/src/modules/analytics/analytics.service.ts');
  assert.match(service, /input\.eventType === 'PURCHASE'/);
  assert.match(service, /PURCHASE_EVENT_REQUIRES_VERIFIED_PAYMENT/);
  assert.match(service, /row\.eventType !== 'PURCHASE'/);
  assert.match(service, /verifiedPurchaseSignals\(userId, safeLimit\)/);
});

test('purchase intent derives only from succeeded verified payments and excludes refunds', () => {
  const repository = source('apps/api/src/modules/analytics/analytics.repository.ts');
  assert.match(repository, /async verifiedPurchaseSignals\(/);
  assert.match(repository, /status = 'SUCCEEDED'/);
  assert.match(repository, /o\.status NOT IN \('REFUNDED', 'CANCELLED'\)/);
  assert.match(repository, /o\.buyer_id = \$\{userId\}::uuid/);
});

test('candidate selection excludes out-of-stock, suspended sellers and non-active listings', () => {
  const repository = source('apps/api/src/modules/catalog/catalog.repository.ts');
  assert.match(repository, /listRecommendationProducts\([\s\S]*status: 'ACTIVE', \.\.\.PUBLIC_SELLER_POLICY, inventory: \{ is: \{ availableQuantity: \{ gt: 0 \} \} \}/);
});

test('only recommendations use catalog fallback; pricing and fraud remain non-authoritative and separate', () => {
  const bridge = source('apps/api/src/modules/ai-bridge/ai-bridge.service.ts');
  const pricing = bridge.slice(bridge.indexOf('async smartPricing('), bridge.indexOf('async similar('));
  const fraud = bridge.slice(bridge.indexOf('async assessPaymentRisk('));
  assert.doesNotMatch(pricing, /catalogFallback/);
  assert.doesNotMatch(fraud, /catalogFallback/);
  assert.match(bridge, /error\.getStatus\(\) === 502 \|\| error\.getStatus\(\) === 503/);
});

test('buyer homepage and product actions use the backend API instead of fabricating recommendation scores', () => {
  const widget = source('apps/web/components/personalized-recommendations.tsx');
  const home = source('apps/web/app/page.tsx');
  const product = source('apps/web/components/product-card.tsx');
  assert.match(home, /<PersonalizedRecommendations \/>/);
  assert.match(widget, /user\?\.role === 'BUYER'/);
  assert.match(widget, /ai\/recommendations\?limit=8/);
  assert.match(widget, /resolveActiveProducts/);
  assert.match(product, /eventType: 'ADD_TO_CART'/);
  assert.match(product, /eventType: 'WISHLIST'/);
});

test('seller analytics overview and pricing calls are available through web proxy', () => {
  const proxy = source('apps/web/app/api/tradenest/[...path]/route.ts');
  const insights = source('apps/web/app/seller/ai-insights/page.tsx');
  assert.match(proxy, /seller\\\/analytics\(\?:\\\/\(\?:overview\|revenue\)\)\?/);
  assert.match(insights, /import \{ apiData, jsonData \} from '@\/lib\/api-client'/);
});
