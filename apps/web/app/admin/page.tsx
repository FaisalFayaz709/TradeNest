'use client';

import Link from 'next/link';
import { AlertTriangle, Boxes, CreditCard, Gavel, PackageSearch, ShieldCheck, Store, Users, WalletCards } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { Card } from '@/components/ui/card';
import { apiData } from '@/lib/api-client';
import type { AdminDashboard } from '@/lib/api-types';

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminDashboard | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void apiData<AdminDashboard>('admin/dashboard').then(setData).catch((value) => setError(value instanceof Error ? value.message : 'Could not load admin overview.')); }, []);
  return <AdminShell title="Overview" description="Monitor marketplace operations without bypassing module ownership or financial state machines.">{error ? <ErrorNotice message={error} /> : !data ? <LoadingState label="Loading admin overview…" /> : <div className="grid gap-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Users} label="Users" value={data.counts.users} href="/admin/users" /><Metric icon={Store} label="Sellers" value={data.counts.sellers} href="/admin/sellers" /><Metric icon={PackageSearch} label="Products" value={data.counts.products} href="/admin/products" /><Metric icon={Boxes} label="Orders" value={data.counts.orders} href="/admin/orders" /><Metric icon={CreditCard} label="Payments" value={data.counts.payments} href="/admin/payments" /><Metric icon={WalletCards} label="Escrows" value={data.counts.escrows} href="/admin/escrow" /><Metric icon={Gavel} label="Open disputes" value={data.openDisputes} href="/admin/disputes" /><Metric icon={AlertTriangle} label="High-risk (recent)" value={data.recentHighRiskAlerts} href="/admin/fraud-alerts" /></div><Card className="p-6"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 text-[var(--tradenest-gold)]" /><div><h2 className="font-semibold text-[var(--tradenest-navy)]">Authority stays in NestJS</h2><p className="mt-2 text-sm leading-6 text-[var(--tradenest-text-secondary)]">This workspace reads module-owned operational views. Financial release/refund remains behind the escrow/dispute state machine, and payment success still comes only from verified provider state.</p></div></div></Card></div>}</AdminShell>;
}
function Metric({ icon: Icon, label, value, href }: { icon: typeof Users; label: string; value: number; href: string }) { return <Link href={href}><Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md"><Icon className="size-5 text-[var(--tradenest-navy)]" /><p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--tradenest-text-secondary)]">{label}</p><p className="mt-1 text-2xl font-semibold text-[var(--tradenest-navy)]">{value}</p></Card></Link>; }
