'use client';

import Link from 'next/link';
import { BarChart3, Boxes, PackageCheck, ShieldCheck, Store } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { SellerShell } from '@/components/seller/seller-shell';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiData, jsonData, TradeNestApiError } from '@/lib/api-client';
import type { SellerAnalytics, SellerDashboard, SellerProfile } from '@/lib/api-types';
import { formatMoney } from '@/lib/money';

export default function SellerDashboardPage() {
  return <SellerShell title="Dashboard" description="Operate your store from backend-authoritative seller data. Financial and fulfillment states remain controlled by NestJS."><Dashboard /></SellerShell>;
}

function Dashboard() {
  const [dashboard, setDashboard] = useState<SellerDashboard | null>(null);
  const [analytics, setAnalytics] = useState<SellerAnalytics | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const result = await apiData<SellerDashboard>('seller/dashboard'); setDashboard(result); setMissing(false);
      void apiData<SellerAnalytics>('seller/analytics/overview').then(setAnalytics).catch(() => setAnalytics(null));
    } catch (value) {
      if (value instanceof TradeNestApiError && value.code === 'SELLER_PROFILE_NOT_FOUND') setMissing(true);
      else setError(value instanceof Error ? value.message : 'Could not load seller dashboard.');
    } finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;

    void apiData<SellerDashboard>('seller/dashboard')
      .then((result) => {
        if (!active) return;
        setDashboard(result);
        setMissing(false);

        void apiData<SellerAnalytics>('seller/analytics/overview')
          .then((insights) => {
            if (active) setAnalytics(insights);
          })
          .catch(() => {
            if (active) setAnalytics(null);
          });
      })
      .catch((value: unknown) => {
        if (!active) return;
        if (value instanceof TradeNestApiError && value.code === 'SELLER_PROFILE_NOT_FOUND') {
          setMissing(true);
        } else {
          setError(value instanceof Error ? value.message : 'Could not load seller dashboard.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);
  if (loading) return <LoadingState label="Loading seller dashboard…" />;
  if (error) return <ErrorNotice message={error} />;
  if (missing) return <Onboarding onComplete={() => void load()} />;
  if (!dashboard) return null;
  const profile = dashboard.profile;
  return <div className="grid gap-6"><Card className="p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Store className="size-5 text-[var(--tradenest-teal)]" /><h2 className="text-xl font-semibold text-[var(--tradenest-navy)]">{profile.storeName}</h2><Badge tone={profile.status === 'ACTIVE' ? 'success' : 'warning'}>{profile.status}</Badge></div><p className="mt-2 text-sm text-[var(--tradenest-text-secondary)]">Store slug: {profile.slug}{profile.rating === null ? ' · No rating yet' : ` · Rating ${profile.rating.toFixed(1)}/5`}</p></div><Button variant="outline" asChild><Link href="/seller/settings">Store settings</Link></Button></div></Card><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={PackageCheck} label="Orders" value={String(analytics?.kpis.orderCount ?? '—')} /><Metric icon={Boxes} label="Units sold" value={String(analytics?.kpis.productsSold ?? '—')} /><Metric icon={BarChart3} label="Conversion" value={analytics?.kpis.conversionRatePercent == null ? '—' : `${analytics.kpis.conversionRatePercent.toFixed(2)}%`} /><Metric icon={ShieldCheck} label="Escrow states" value={String(analytics?.escrowByStatus.length ?? '—')} /></div>{analytics?.kpis.revenueByCurrency.length ? <Card className="p-6"><h2 className="font-semibold text-[var(--tradenest-navy)]">Revenue</h2><div className="mt-4 flex flex-wrap gap-3">{analytics.kpis.revenueByCurrency.map((money) => <div key={money.currency} className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs text-[var(--tradenest-text-secondary)]">{money.currency}</p><p className="mt-1 text-lg font-semibold text-[var(--tradenest-navy)]">{formatMoney(money.amount, money.currency)}</p></div>)}</div></Card> : null}<div className="grid gap-4 md:grid-cols-3"><Quick href="/seller/products" title="Catalog" text="Create, publish, archive, and maintain your own products." /><Quick href="/seller/orders" title="Fulfillment" text="Review seller orders and create eligible shipments." /><Quick href="/seller/analytics" title="Analytics" text="Inspect authoritative KPIs, stock signals, and escrow distribution." /></div></div>;
}

function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [storeName, setStoreName] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(null); try { await jsonData<SellerProfile>('seller/onboard', 'POST', { storeName }); onComplete(); } catch (value) { setError(value instanceof Error ? value.message : 'Could not onboard seller.'); } finally { setBusy(false); } }
  return <Card className="mx-auto max-w-2xl p-8"><Store className="size-8 text-[var(--tradenest-teal)]" /><h2 className="mt-4 text-2xl font-semibold text-[var(--tradenest-navy)]">Activate your store</h2><p className="mt-2 text-sm leading-6 text-[var(--tradenest-text-secondary)]">Your account already has the SELLER role. Create the seller profile before catalog actions; the backend derives the stable slug and starts the profile ACTIVE.</p><form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row"><Input value={storeName} onChange={(event) => setStoreName(event.target.value)} placeholder="Store name" maxLength={200} required /> <Button type="submit" disabled={busy}>{busy ? 'Activating…' : 'Activate store'}</Button></form>{error ? <div className="mt-4"><ErrorNotice message={error} /></div> : null}</Card>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: string }) { return <Card className="p-5"><Icon className="size-5 text-[var(--tradenest-teal)]" /><p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--tradenest-text-secondary)]">{label}</p><p className="mt-1 text-2xl font-semibold text-[var(--tradenest-navy)]">{value}</p></Card>; }
function Quick({ href, title, text }: { href: string; title: string; text: string }) { return <Link href={href}><Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md"><h3 className="font-semibold text-[var(--tradenest-navy)]">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--tradenest-text-secondary)]">{text}</p></Card></Link>; }
