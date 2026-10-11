'use client';

import { useEffect, useState } from 'react';
import { BrainCircuit } from 'lucide-react';
import { useSession } from './session-provider';
import { ProductCard } from './product-card';
import { apiData, resolveActiveProducts } from '@/lib/api-client';
import type { Product } from '@/lib/api-types';
import type { RecommendationSet } from '@tradenest/contracts/ai';

/** Buyer-only recommendations; neither AI scores nor client state set prices. */
export function PersonalizedRecommendations() {
  const { user } = useSession();
  const buyerId = user?.role === 'BUYER' ? user.id : null;
  const [products, setProducts] = useState<Product[]>([]);
  const [modelVersion, setModelVersion] = useState('');

  useEffect(() => {
    let cancelled = false;
    setProducts([]);
    setModelVersion('');
    if (!buyerId) return () => { cancelled = true; };
    void (async () => {
      try {
        const result = await apiData<RecommendationSet>('ai/recommendations?limit=8');
        const items = await resolveActiveProducts(result.items.map((item) => item.productId));
        if (!cancelled) {
          setProducts(result.items.flatMap((item) => {
            const product = items.get(item.productId);
            return product && product.availableQuantity > 0 ? [product] : [];
          }));
          setModelVersion(result.modelVersion);
        }
      } catch {
        // Recommendations are optional; never block the regular marketplace.
        if (!cancelled) setProducts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [buyerId]);

  if (!buyerId || products.length === 0) return null;
  const catalogMode = modelVersion === 'catalog-fallback-v1';
  return (
    <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8" aria-label="Recommended products">
      <div className="mb-6 flex items-center gap-3">
        <BrainCircuit className="size-6 text-[var(--tradenest-teal)]" aria-hidden="true" />
        <div>
          <h2 className="text-2xl font-semibold text-[var(--tradenest-navy)]">Recommended for you</h2>
          <p className="mt-1 text-sm text-[var(--tradenest-text-secondary)]">
            {catalogMode ? 'Fresh available listings while we learn your preferences.' : 'Suggestions informed by your marketplace activity.'}
          </p>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>
  );
}
