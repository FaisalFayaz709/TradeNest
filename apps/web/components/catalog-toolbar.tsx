'use client';

import Link from 'next/link';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiData } from '@/lib/api-client';
import type { Category } from '@/lib/api-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** URL-driven public catalog filters. Search and category are the existing API filters. */
export function CatalogToolbar({ query, categoryId }: { query: string; categoryId: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryError, setCategoryError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(categoryId);
  const [searchText, setSearchText] = useState(query);

  useEffect(() => {
    let active = true;
    void apiData<Category[]>('categories')
      .then((result) => { if (active) setCategories(result); })
      .catch(() => { if (active) setCategoryError(true); });
    return () => { active = false; };
  }, []);

  const options = useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category]));
    return [...categories].sort((a, b) => {
      const parentA = a.parentId ? byId.get(a.parentId)?.name ?? '' : '';
      const parentB = b.parentId ? byId.get(b.parentId)?.name ?? '' : '';
      return `${parentA} ${a.name}`.localeCompare(`${parentB} ${b.name}`);
    }).map((category) => ({
      id: category.id,
      label: category.parentId && byId.has(category.parentId)
        ? `${byId.get(category.parentId)?.name} / ${category.name}`
        : category.name,
    }));
  }, [categories]);

  return (
    <section aria-label="Refine marketplace results" className="min-w-0 rounded-[var(--tradenest-radius-card)] border border-[var(--tradenest-border)] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[var(--tradenest-navy)]">
        <SlidersHorizontal className="size-4 text-[var(--tradenest-teal-ink)]" aria-hidden="true" />
        <h2 className="text-base font-semibold">Find your next purchase</h2>
        <span className="text-xs text-[var(--tradenest-text-secondary)]">Search and filter live listings</span>
      </div>
      <form action="/explore" method="GET" role="search" className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,240px)_auto] sm:items-end">
        <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-[var(--tradenest-text)]" htmlFor="catalog-keywords">
          Search products
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--tradenest-text-secondary)]" aria-hidden="true" />
            <Input id="catalog-keywords" type="search" name="q" maxLength={200} value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="What are you looking for?" className="pl-10" />
          </span>
        </label>
        <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-[var(--tradenest-text)]" htmlFor="catalog-category">
          Category
          <select id="catalog-category" name="categoryId" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="min-h-11 min-w-0 w-full rounded-[var(--tradenest-radius-control)] border border-[var(--tradenest-border-strong)] bg-white px-3 text-sm text-[var(--tradenest-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tradenest-focus)]">
            <option value="">All categories</option>
            {selectedCategory && !options.some((item) => item.id === selectedCategory) ? <option value={selectedCategory}>Selected category</option> : null}
            {options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <Button type="submit" className="w-full sm:w-auto"><Search className="size-4" aria-hidden="true" />Show products</Button>
      </form>
      <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-5 text-[var(--tradenest-text-secondary)]">
          {categoryError ? 'Category filters are temporarily unavailable. You can still search by name.' : 'Use a keyword, a category, or both.'}
        </p>
        {query || categoryId ? <Link href="/explore" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[var(--tradenest-blue)] hover:underline"><X className="size-4" aria-hidden="true" />Clear filters</Link> : null}
      </div>
    </section>
  );
}
