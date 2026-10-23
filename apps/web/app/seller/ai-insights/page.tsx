'use client';

import { BrainCircuit, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SellerShell } from '@/components/seller/seller-shell';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { jsonData } from '@/lib/api-client';
import type { Product, SmartPricingSuggestion } from '@/lib/api-types';
import { allSellerProducts } from '@/lib/seller-data';
import { formatMoney } from '@/lib/money';

export default function SellerAiInsightsPage() { return <SellerShell title="AI Insights" description="Pricing intelligence is advisory. AI may recommend a range, but only the seller can choose to update catalog pricing through normal product APIs."><Insights /></SellerShell>; }
function Insights() {
  const [products, setProducts] = useState<Product[]>([]); const [insights, setInsights] = useState<Record<string, SmartPricingSuggestion>>({}); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void allSellerProducts().then((items) => setProducts(items.filter((item) => item.status === 'ACTIVE'))).catch((value) => setError(value instanceof Error ? value.message : 'Could not load products.')).finally(() => setLoading(false)); }, []);
  async function load(productId: string) { setBusy(productId); setError(null); try { const result = await jsonData<SmartPricingSuggestion>(`seller/products/${productId}/price-suggestion`, 'POST'); setInsights((current) => ({ ...current, [productId]: result })); } catch (value) { setError(value instanceof Error ? value.message : 'Could not generate pricing insight.'); } finally { setBusy(null); } }
  if (loading) return <LoadingState label="Loading AI insight candidates…" />;
  return <div className="grid gap-4">{error ? <ErrorNotice message={error} /> : null}{products.map((product) => { const insight = insights[product.id]; return <Card key={product.id} className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><BrainCircuit className="size-5 text-[var(--tradenest-teal)]" /><h2 className="font-semibold text-[var(--tradenest-navy)]">{product.name}</h2></div><p className="mt-1 text-xs text-[var(--tradenest-text-secondary)]">Current price {formatMoney(product.price, product.currency)} · SKU {product.sku}</p></div><Button variant="ai" size="sm" onClick={() => void load(product.id)} disabled={busy === product.id}><Sparkles className="size-4" />{busy === product.id ? 'Analyzing…' : 'Generate insight'}</Button></div>{insight ? <div className="mt-4 grid gap-4 rounded-xl bg-[var(--tradenest-teal-light)] p-4 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--tradenest-teal)]">Suggested range</p><p className="mt-1 text-xl font-semibold text-[var(--tradenest-navy)]">{formatMoney(insight.suggestedRange.minPrice, insight.currency)} – {formatMoney(insight.suggestedRange.maxPrice, insight.currency)}</p><p className="mt-2 text-xs text-[var(--tradenest-text-secondary)]">Model {insight.modelVersion} · advisory={String(insight.advisory)}</p></div><div className="grid grid-cols-2 gap-2 text-xs"><Signal label="Views" value={insight.signals.productViews} /><Signal label="Cart events" value={insight.signals.addToCartEvents} /><Signal label="Completed units" value={insight.signals.completedUnitsSold} /><Signal label="Comparables" value={insight.signals.comparableProductCount} /></div></div> : null}</Card>; })}{!products.length ? <Card className="p-8 text-center text-sm text-[var(--tradenest-text-secondary)]">Smart pricing is available only for ACTIVE seller products.</Card> : null}</div>;
}
function Signal({ label, value }: { label: string; value: number }) { return <div className="rounded-lg bg-white/70 p-2"><p className="text-[var(--tradenest-text-secondary)]">{label}</p><p className="mt-1 font-semibold text-[var(--tradenest-navy)]">{value}</p></div>; }
