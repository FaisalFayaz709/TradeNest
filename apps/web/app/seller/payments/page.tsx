'use client';

import { CreditCard, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SellerShell } from '@/components/seller/seller-shell';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { apiData } from '@/lib/api-client';
import type { SellerAnalytics } from '@/lib/api-types';
import { formatMoney } from '@/lib/money';

export default function SellerPaymentsPage() { return <SellerShell title="Payments" description="Seller financial visibility is intentionally settlement-oriented. Buyer payment-provider objects remain Buyer/Admin scoped; sellers see authoritative revenue and escrow outcomes instead."><Payments /></SellerShell>; }
function Payments() {
  const [data, setData] = useState<SellerAnalytics | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void apiData<SellerAnalytics>('seller/analytics/overview').then(setData).catch((value) => setError(value instanceof Error ? value.message : 'Could not load seller financial summary.')).finally(() => setLoading(false)); }, []);
  if (loading) return <LoadingState label="Loading financial summary…" />; if (error) return <ErrorNotice message={error} />; if (!data) return null;
  return <div className="grid gap-6"><Card className="border-[var(--tradenest-gold)] bg-[var(--tradenest-gold-light)] p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 text-[var(--tradenest-gold)]" /><div><h2 className="font-semibold text-[var(--tradenest-navy)]">Protected transaction view</h2><p className="mt-1 text-sm leading-6 text-[var(--tradenest-text-secondary)]">A seller cannot query arbitrary buyer payment records through the current backend contract. This screen therefore reports seller revenue and escrow state, preserving payment ownership and privacy boundaries.</p></div></div></Card><div className="grid gap-4 sm:grid-cols-2">{data.kpis.revenueByCurrency.map((money) => <Card key={money.currency} className="p-5"><CreditCard className="size-5 text-[var(--tradenest-teal)]" /><p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--tradenest-text-secondary)]">Recognized revenue · {money.currency}</p><p className="mt-1 text-2xl font-semibold text-[var(--tradenest-navy)]">{formatMoney(money.amount, money.currency)}</p></Card>)}{!data.kpis.revenueByCurrency.length ? <Card className="p-6 text-sm text-[var(--tradenest-text-secondary)]">No seller revenue is available yet.</Card> : null}</div><Card className="p-5"><h2 className="font-semibold text-[var(--tradenest-navy)]">Escrow financial states</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.escrowByStatus.map((row) => <div key={`${row.status}-${row.currency}`} className="rounded-xl border border-[var(--tradenest-border)] p-4"><div className="flex items-center justify-between gap-3"><Badge tone={row.status === 'RELEASED' ? 'success' : row.status === 'REFUNDED' ? 'danger' : 'escrow'}>{row.status.replaceAll('_', ' ')}</Badge><span className="text-xs text-[var(--tradenest-text-secondary)]">{row.count} record{row.count === 1 ? '' : 's'}</span></div><p className="mt-3 text-lg font-semibold text-[var(--tradenest-navy)]">{formatMoney(row.amount, row.currency)}</p></div>)}</div></Card></div>;
}
