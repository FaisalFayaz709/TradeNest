'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useSession } from './session-provider';
import { ProductCard } from './product-card';
import { apiData, resolveActiveProducts } from '@/lib/api-client';
import type { Product } from '@/lib/api-types';
import type { RecommendationSet } from '@tradenest/contracts/ai';

/** Suggestions are buyer-only. A change of buyer remounts state, preventing stale results from appearing. */
export function PersonalizedRecommendations() {
  const { user } = useSession();
  if (user?.role !== 'BUYER') return null;
  return <BuyerRecommendations key={user.id} />;
}

function BuyerRecommendations() {
  const [products, setProducts] = useState<Product[]>([]);
  const [modelVersion, setModelVersion] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await apiData<RecommendationSet>('ai/recommendations?limit=8');
        const items = await resolveActiveProducts(result.items.map((item) => item.productId));
        if (!active) return;
        setProducts(result.items.flatMap((item) => {
          const product = items.get(item.productId);
          return product && product.availableQuantity > 0 ? [product] : [];
        }));
        setModelVersion(result.modelVersion);
      } catch {
        // Recommendations are optional; never block the regular marketplace.
        if (active) setProducts([]);
      }
    })();
    return () => { active = false; };
  }, []);

  if (!products.length) return null;
  const catalogMode = modelVersion === 'catalog-fallback-v1';
  return (
    <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8" aria-label="Recommended products">
      <div className="mb-6 flex items-center gap-3">
        <Sparkles className="size-6 text-[var(--tradenest-teal-ink)]" aria-hidden="true" />
        <div>
          <h2 className="text-2xl font-semibold text-[var(--tradenest-navy)]">Picked for your browsing</h2>
          <p className="mt-1 text-sm text-[var(--tradenest-text-secondary)]">
            {catalogMode ? 'Available products to help you explore.' : 'Suggestions based on your activity on TradeNest.'}
          </p>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>
  );
}
