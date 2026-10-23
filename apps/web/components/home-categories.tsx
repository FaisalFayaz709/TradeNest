'use client';

import Link from 'next/link';
import { ArrowUpRight, Boxes } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiData } from '@/lib/api-client';
import type { Category } from '@/lib/api-types';

/** Category labels and IDs come from the live public category API; never hardcoded. */
export function HomeCategories() {
  const [categories, setCategories] = useState<Category[] | null>(null);

  useEffect(() => {
    let active = true;
    void apiData<Category[]>('categories')
      .then((items) => {
        if (!active) return;
        const roots = items.filter((item) => item.parentId === null);
        setCategories((roots.length ? roots : items).slice(0, 6));
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => { active = false; };
  }, []);

  if (categories === null) {
    return <div role="status" aria-live="polite" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"><span className="sr-only">Loading categories…</span>{Array.from({ length: 6 }, (_, index) => <div key={index} aria-hidden="true" className="h-28 animate-pulse rounded-[var(--tradenest-radius-card)] bg-slate-100" />)}</div>;
  }

  if (!categories.length) {
    return <Link href="/categories" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--tradenest-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--tradenest-blue)] hover:border-[var(--tradenest-teal)]">Explore all categories <ArrowUpRight className="size-4" aria-hidden="true" /></Link>;
  }

  return (
    <nav aria-label="Shop by category" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {categories.map((category) => (
        <Link key={category.id} href={`/explore?categoryId=${encodeURIComponent(category.id)}`} className="group flex min-h-28 min-w-0 flex-col justify-between gap-4 rounded-[var(--tradenest-radius-card)] border border-[var(--tradenest-border)] bg-white p-4 shadow-[0_4px_20px_rgba(11,42,74,0.035)] transition hover:-translate-y-0.5 hover:border-[var(--tradenest-teal)] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tradenest-focus)]">
          <div className="flex items-start justify-between gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--tradenest-teal-light)] text-[var(--tradenest-teal-ink)]"><Boxes className="size-4" aria-hidden="true" /></span>
            <ArrowUpRight className="size-4 shrink-0 text-slate-400 transition group-hover:text-[var(--tradenest-teal-ink)]" aria-hidden="true" />
          </div>
          <span className="text-sm font-semibold leading-5 text-[var(--tradenest-navy)] [overflow-wrap:anywhere]">{category.name}</span>
        </Link>
      ))}
    </nav>
  );
}
