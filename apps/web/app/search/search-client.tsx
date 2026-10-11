'use client';

import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { CatalogGrid } from '@/components/catalog-grid';
import { PageShell } from '@/components/page-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function SearchPage() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get('q') || '';
  const [value, setValue] = useState(query);
  function submit(event: FormEvent) { event.preventDefault(); const next = value.trim(); router.push(next ? `/search?q=${encodeURIComponent(next)}` : '/search'); }
  return <PageShell eyebrow="Catalog search" title="Search products" description="Search runs against the active public catalog; checkout still reloads authoritative product, seller, price, and inventory state."><form onSubmit={submit} className="mb-8 flex max-w-2xl gap-2"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Search products…" className="pl-9" maxLength={200} /></div><Button type="submit">Search</Button></form>{query ? <CatalogGrid key={query} query={query} /> : <div className="rounded-[var(--tradenest-radius-card)] border border-dashed border-[var(--tradenest-border)] bg-white p-10 text-center text-sm text-[var(--tradenest-text-secondary)]">Enter a product name or keyword to search TradeNest.</div>}</PageShell>;
}
