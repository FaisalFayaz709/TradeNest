'use client';

import Link from 'next/link';
import { ChevronRight, Gavel } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SellerShell } from '@/components/seller/seller-shell';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { apiData } from '@/lib/api-client';
import type { Dispute } from '@/lib/api-types';

export default function SellerDisputesPage() { return <SellerShell title="Disputes" description="Review disputes where your seller account is a participant, then add messages or evidence while the case remains open. Resolution stays Admin-only."><Disputes /></SellerShell>; }
function Disputes() {
  const [rows, setRows] = useState<Dispute[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void apiData<Dispute[]>('seller/disputes').then(setRows).catch((value) => setError(value instanceof Error ? value.message : 'Could not load disputes.')).finally(() => setLoading(false)); }, []);
  if (loading) return <LoadingState label="Loading disputes…" />; if (error) return <ErrorNotice message={error} />;
  return <div className="grid gap-4">{rows.map((dispute) => <Link key={dispute.id} href={`/seller/disputes/${dispute.id}`}><Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between gap-4"><div className="flex items-start gap-3"><Gavel className="mt-0.5 size-5 text-amber-600" /><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[var(--tradenest-navy)]">{dispute.reason}</p><Badge tone={dispute.status === 'OPEN' ? 'warning' : 'success'}>{dispute.status}</Badge></div><p className="mt-1 line-clamp-1 text-sm text-[var(--tradenest-text-secondary)]">{dispute.description}</p><p className="mt-1 text-xs text-[var(--tradenest-text-secondary)]">Opened {new Date(dispute.openedAt).toLocaleString()}</p></div></div><ChevronRight className="size-5 text-slate-400" /></div></Card></Link>)}{!rows.length ? <Card className="p-8 text-center text-sm text-[var(--tradenest-text-secondary)]">No disputes currently involve this seller account.</Card> : null}</div>;
}
