'use client';

import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { CatalogGrid } from '@/components/catalog-grid';
import { PageShell } from '@/components/page-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function SearchClient() {
  const params = useSearchParams();
  const query = params.get('q') || '';

  return (
    <PageShell eyebrow="Search the marketplace" title={query ? `Results for “${query}”` : 'What are you looking for?'} description="Search products from active TradeNest listings, or explore the full marketplace by category.">
      <form key={query} action="/search" method="GET" role="search" className="mb-7 flex min-w-0 flex-col gap-3 sm:max-w-3xl sm:flex-row">
        <label htmlFor="search-keywords" className="relative block min-w-0 flex-1">
          <span className="sr-only">Product name or keyword</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--tradenest-text-secondary)]" aria-hidden="true" />
          <Input id="search-keywords" name="q" type="search" defaultValue={query} placeholder="Search products…" className="pl-10" maxLength={200} />
        </label>
        <Button type="submit" className="w-full sm:w-auto">Search products</Button>
      </form>
      {query.trim() ? <CatalogGrid key={query} query={query} /> : (
        <div className="flex min-w-0 flex-col items-center gap-4 rounded-[var(--tradenest-radius-card)] border border-dashed border-[var(--tradenest-border)] bg-white px-5 py-10 text-center sm:py-14">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-[var(--tradenest-teal-light)] text-[var(--tradenest-teal-ink)]"><Search className="size-6" aria-hidden="true" /></span>
          <h2 className="text-xl font-semibold text-[var(--tradenest-navy)]">Find the right product</h2>
          <p className="max-w-md text-sm leading-6 text-[var(--tradenest-text-secondary)]">Enter a name or keyword above to see matching listings, or browse every category instead.</p>
          <Button variant="outline" asChild><Link href="/explore">Explore all products <ArrowRight className="size-4" aria-hidden="true" /></Link></Button>
        </div>
      )}
    </PageShell>
  );
}
