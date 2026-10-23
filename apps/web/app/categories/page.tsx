'use client';

import Link from 'next/link';
import { ArrowRight, Boxes, ChevronRight, LayoutGrid } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { LoadingState } from '@/components/loading-state';
import { ErrorNotice } from '@/components/error-notice';
import { apiData } from '@/lib/api-client';
import type { Category } from '@/lib/api-types';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiData<Category[]>('categories')
      .then((result) => { if (active) setCategories(result); })
      .catch((value) => { if (active) setError(value instanceof Error ? value.message : 'Could not load categories.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const roots = useMemo(() => {
    const known = new Set(categories.map((category) => category.id));
    const top = categories.filter((category) => !category.parentId || !known.has(category.parentId));
    return (top.length ? top : categories).sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  return (
    <PageShell eyebrow="Shop your way" title="Browse categories" description="Explore the TradeNest catalog one category at a time.">
      {error ? <ErrorNotice message={error} /> : null}
      {loading ? <LoadingState label="Loading categories…" /> : !error && categories.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="Categories are on their way" description="There are no categories to browse right now. You can still explore the marketplace." action={<Link href="/explore" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--tradenest-navy)] px-4 py-2 text-sm font-semibold text-white">Browse all products <ArrowRight className="size-4" aria-hidden="true" /></Link>} />
      ) : !error ? (
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
          {roots.map((category) => {
            const children = categories.filter((item) => item.parentId === category.id).sort((a, b) => a.name.localeCompare(b.name));
            const href = `/explore?categoryId=${encodeURIComponent(category.id)}`;
            return (
              <Card key={category.id} className="flex min-w-0 flex-col p-5 transition-shadow hover:shadow-[0_14px_36px_rgba(11,42,74,0.1)] sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--tradenest-teal-light)] text-[var(--tradenest-teal-ink)]"><Boxes className="size-6" aria-hidden="true" /></div>
                  <div className="min-w-0 flex-1">
                    <Link href={href} className="inline-flex min-h-11 min-w-0 items-center gap-2 break-words text-lg font-semibold leading-6 text-[var(--tradenest-navy)] hover:underline">{category.name}<ChevronRight className="size-4 shrink-0" aria-hidden="true" /></Link>
                    <p className="mt-1 text-sm text-[var(--tradenest-text-secondary)]">Browse the latest listings</p>
                  </div>
                </div>
                {children.length ? (
                  <div aria-label={`Subcategories of ${category.name}`} className="mt-5 flex flex-wrap gap-2">
                    {children.map((child) => <Link key={child.id} href={`/explore?categoryId=${encodeURIComponent(child.id)}`} className="inline-flex min-h-10 max-w-full items-center rounded-full border border-[var(--tradenest-border)] bg-slate-50 px-3 py-2 text-xs font-semibold text-[var(--tradenest-blue)] hover:border-[var(--tradenest-teal)] hover:bg-[var(--tradenest-teal-light)]">{child.name}</Link>)}
                  </div>
                ) : null}
                <Link href={href} className="mt-auto inline-flex min-h-11 items-center gap-2 pt-5 text-sm font-semibold text-[var(--tradenest-blue)] hover:underline">View products <ArrowRight className="size-4" aria-hidden="true" /></Link>
              </Card>
            );
          })}
        </div>
      ) : null}
    </PageShell>
  );
}
