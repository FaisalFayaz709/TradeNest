'use client';

import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Category, PaginationMeta, Product } from '@/lib/api-types';
import { apiCollection, apiData } from '@/lib/api-client';
import { ProductCard } from './product-card';
import { LoadingState } from './loading-state';
import { ErrorNotice } from './error-notice';
import { EmptyState } from './empty-state';
import { Button } from './ui/button';

export function CatalogGrid(props: { query?: string; categoryId?: string; pageSize?: number; showCategoryFilter?: boolean }) {
  return (
    <CatalogGridContent
      key={JSON.stringify([props.query ?? '', props.categoryId ?? ''])}
      {...props}
    />
  );
}

function CatalogGridContent({ query = '', categoryId = '', pageSize = 12, showCategoryFilter = true }: { query?: string; categoryId?: string; pageSize?: number; showCategoryFilter?: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: pageSize, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState(categoryId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (!showCategoryFilter) return;
    void apiData<Category[]>('categories').then(setCategories).catch(() => setCategories([]));
  }, [showCategoryFilter]);

  useEffect(() => {
    let active = true;

    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });

    if (query.trim()) params.set('q', query.trim());
    if (selectedCategory) params.set('categoryId', selectedCategory);

    void apiCollection<Product>(`products?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        setProducts(response.data);
        setMeta(response.meta);
        setError(null);
      })
      .catch((value: unknown) => {
        if (!active) return;
        setError(value instanceof Error ? value.message : 'Could not load products.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, pageSize, query, selectedCategory]);

  function selectCategory(next: string) {
    if (next === selectedCategory && page === 1) return;
    setLoading(true);
    setError(null);
    setSelectedCategory(next);
    setPage(1);
  }

  function changePage(next: number) {
    if (next === page) return;
    setLoading(true);
    setError(null);
    setPage(next);
  }

  return (
    <div>
      {showCategoryFilter ? <div className="mb-6 flex flex-wrap gap-2"><button type="button" onClick={() => selectCategory('')} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${!selectedCategory ? 'border-[var(--tradenest-navy)] bg-[var(--tradenest-navy)] text-white' : 'border-[var(--tradenest-border)] bg-white text-[var(--tradenest-text-secondary)]'}`}>All</button>{categories.map((category) => <button key={category.id} type="button" onClick={() => selectCategory(category.id)} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${selectedCategory === category.id ? 'border-[var(--tradenest-navy)] bg-[var(--tradenest-navy)] text-white' : 'border-[var(--tradenest-border)] bg-white text-[var(--tradenest-text-secondary)]'}`}>{category.name}</button>)}</div> : null}
      {error ? <ErrorNotice message={error} /> : null}
      {loading ? <LoadingState label="Loading marketplace products…" /> : products.length === 0 ? <EmptyState icon={SearchX} title="No products found" description="Try another search or category. TradeNest only exposes active products through the public catalog." /> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>}
      {!loading && meta.totalPages > 1 ? <div className="mt-8 flex items-center justify-between"><p className="text-sm text-[var(--tradenest-text-secondary)]">Page {meta.page} of {meta.totalPages} · {meta.total} products</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => changePage(Math.max(1, page - 1))}><ChevronLeft className="size-4" />Previous</Button><Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => changePage(page + 1)}>Next<ChevronRight className="size-4" /></Button></div></div> : null}
    </div>
  );
}
