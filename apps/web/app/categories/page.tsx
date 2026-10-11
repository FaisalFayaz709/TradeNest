'use client';

import Link from 'next/link';
import { Boxes, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { Card } from '@/components/ui/card';
import { LoadingState } from '@/components/loading-state';
import { ErrorNotice } from '@/components/error-notice';
import { apiData } from '@/lib/api-client';
import type { Category } from '@/lib/api-types';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void apiData<Category[]>('categories').then(setCategories).catch((value) => setError(value instanceof Error ? value.message : 'Could not load categories.')).finally(() => setLoading(false)); }, []);
  const roots = useMemo(() => categories.filter((category) => category.parentId === null), [categories]);
  const children = (id: string) => categories.filter((category) => category.parentId === id);
  return <PageShell eyebrow="Browse by category" title="Categories" description="Use TradeNest's category tree to narrow the active public catalog.">{error ? <ErrorNotice message={error} /> : null}{loading ? <LoadingState label="Loading categories…" /> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{(roots.length ? roots : categories).map((category) => <Card key={category.id} className="p-5"><div className="flex items-start gap-4"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--tradenest-teal-light)] text-teal-800"><Boxes className="size-5" /></div><div className="min-w-0 flex-1"><Link href={`/explore?categoryId=${category.id}`} className="flex items-center justify-between gap-3 text-lg font-semibold text-[var(--tradenest-navy)] hover:underline"><span>{category.name}</span><ChevronRight className="size-4" /></Link>{children(category.id).length ? <div className="mt-3 flex flex-wrap gap-2">{children(category.id).map((child) => <Link key={child.id} href={`/explore?categoryId=${child.id}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-[var(--tradenest-text-secondary)] hover:bg-slate-200">{child.name}</Link>)}</div> : <p className="mt-2 text-sm text-[var(--tradenest-text-secondary)]">Explore products in this category.</p>}</div></div></Card>)}</div>}</PageShell>;
}
