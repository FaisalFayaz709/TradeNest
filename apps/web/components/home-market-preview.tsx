'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ImageOff, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiCollection } from '@/lib/api-client';
import type { Product } from '@/lib/api-types';
import { formatMoney } from '@/lib/money';

/** Shows real public listings only. Missing catalog data never becomes invented merchandise. */
export function HomeMarketPreview() {
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    let active = true;
    void apiCollection<Product>('products?page=1&limit=6')
      .then(({ data }) => {
        if (active) setProducts(data.filter((product) => product.status === 'ACTIVE' && product.availableQuantity > 0).slice(0, 2));
      })
      .catch(() => {
        if (active) setProducts([]);
      });
    return () => { active = false; };
  }, []);

  return (
    <aside aria-label="Browse marketplace listings" className="relative min-w-0 overflow-hidden rounded-[1.75rem] border border-white/15 bg-white p-4 text-[var(--tradenest-navy)] shadow-[0_22px_65px_rgba(0,0,0,0.2)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--tradenest-border)] pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--tradenest-teal-ink)]">From the marketplace</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Explore real listings</h2>
        </div>
        <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--tradenest-teal-light)] text-[var(--tradenest-teal-ink)]"><ShoppingBag className="size-5" aria-hidden="true" /></span>
      </div>
      {products === null ? (
        <div role="status" aria-live="polite" className="grid gap-3 py-5">
          <span className="sr-only">Loading product previews…</span>
          {[0, 1].map((item) => <div key={item} aria-hidden="true" className="flex items-center gap-4 rounded-xl bg-slate-50 p-3"><div className="size-20 shrink-0 animate-pulse rounded-lg bg-slate-200" /><div className="grid flex-1 gap-3"><div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" /><div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" /></div></div>)}
        </div>
      ) : products.length ? (
        <div className="grid gap-3 py-5">
          {products.map((product) => {
            const photo = product.images.find((image) => image.isPrimary) ?? product.images[0];
            return (
              <Link key={product.id} href={`/products/${encodeURIComponent(product.slug)}`} className="group flex min-w-0 items-center gap-4 rounded-xl border border-[var(--tradenest-border)] p-3 transition hover:border-[var(--tradenest-teal)] hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tradenest-focus)]">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:size-24">
                  {photo ? (
                    // Seller uploads can use different media hosts; remote image optimization is handled by catalog work in Patch 07.
                    <Image src={photo.url} alt={`${product.name} product photo`} fill sizes="96px" unoptimized className="object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : <div className="flex h-full items-center justify-center text-slate-400"><ImageOff className="size-7" aria-hidden="true" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-5 [overflow-wrap:anywhere] sm:text-base">{product.name}</p>
                  <p className="mt-2 text-sm font-bold text-[var(--tradenest-blue)]">{formatMoney(product.price, product.currency)}</p>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--tradenest-teal-ink)]">View product <ArrowRight className="size-3" aria-hidden="true" /></span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-[var(--tradenest-blue)]"><ShoppingBag className="size-6" aria-hidden="true" /></span>
          <p className="max-w-xs text-sm leading-6 text-[var(--tradenest-text-secondary)]">Visit the marketplace to browse the latest available listings.</p>
        </div>
      )}
      <Link href="/explore" className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-[var(--tradenest-navy)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--tradenest-blue)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tradenest-focus)]">
        Browse the marketplace <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
      </Link>
    </aside>
  );
}
