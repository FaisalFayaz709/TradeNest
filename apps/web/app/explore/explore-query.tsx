'use client';

import { useSearchParams } from 'next/navigation';
import { CatalogGrid } from '@/components/catalog-grid';
import { CatalogToolbar } from '@/components/catalog-toolbar';

export function ExploreQueryGrid() {
  const params = useSearchParams();
  const query = params.get('q') || '';
  const categoryId = params.get('categoryId') || '';

  return (
    <div className="grid min-w-0 gap-6 sm:gap-8">
      <CatalogToolbar key={`${query}:${categoryId}`} query={query} categoryId={categoryId} />
      <CatalogGrid key={`${query}:${categoryId}`} categoryId={categoryId} query={query} showCategoryFilter={false} />
    </div>
  );
}
