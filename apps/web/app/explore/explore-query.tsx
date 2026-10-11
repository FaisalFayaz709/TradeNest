'use client';

import { useSearchParams } from 'next/navigation';
import { CatalogGrid } from '@/components/catalog-grid';

export function ExploreQueryGrid() {
  const params = useSearchParams();
  return <CatalogGrid categoryId={params.get('categoryId') || ''} query={params.get('q') || ''} />;
}
