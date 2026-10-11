import type { RecommendationProductFeature } from '../catalog/public/module-api.js';
import type { RecommendationSet } from '@tradenest/contracts/ai';

/**
 * Deterministic catalog-only response: not mislabeled as a personalized ML rank.
 * Products have already passed Catalog's active seller, active listing and
 * available-inventory filters. No authoritative product state is mutated.
 */
export function catalogFallback(
  products: RecommendationProductFeature[],
  limit: number,
  options: { targetProductId?: string } = {},
): RecommendationSet {
  const target = options.targetProductId
    ? products.find((item) => item.productId === options.targetProductId)
    : undefined;
  const filtered = products.filter((product, index, all) =>
    product.productId !== options.targetProductId
    && all.findIndex((other) => other.productId === product.productId) === index,
  );
  if (target) {
    // Similar-product fallback prefers same-category candidates without
    // claiming a learned relevance score.
    filtered.sort((a, b) => Number(b.categoryId === target.categoryId)
      - Number(a.categoryId === target.categoryId));
  }
  return {
    items: filtered.slice(0, Math.min(50, Math.max(1, Math.trunc(limit)))).map((item) => ({
      productId: item.productId,
      score: target && item.categoryId === target.categoryId ? 0.25 : 0.1,
    })),
    modelVersion: 'catalog-fallback-v1',
    generatedAt: new Date().toISOString(),
  };
}
