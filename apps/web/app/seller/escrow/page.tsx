'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SellerShell } from '@/components/seller/seller-shell';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { apiData } from '@/lib/api-client';
import type { Escrow, OrderSummary } from '@/lib/api-types';
import { allSellerOrders } from '@/lib/seller-data';
import { formatMoney } from '@/lib/money';

type EscrowRow = { order: OrderSummary; escrow: Escrow | null };
export default function SellerEscrowPage() { return <SellerShell title="Escrow" description="Follow the money lifecycle per seller order. This is visibility only; sellers cannot directly release or refund escrow through the UI."><EscrowList /></SellerShell>; }
function EscrowList() {
  const [rows, setRows] = useState<EscrowRow[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void (async () => { try { const orders = await allSellerOrders(); const values = await Promise.all(orders.slice(0, 100).map(async (order) => ({ order, escrow: await apiData<Escrow>(`orders/${order.id}/escrow`).catch(() => null) }))); setRows(values); } catch (value) { setError(value instanceof Error ? value.message : 'Could not load escrow records.'); } finally { setLoading(false); } })(); }, []);
  if (loading) return <LoadingState label="Loading escrow visibility…" />; if (error) return <ErrorNotice message={error} />;
  const withEscrow = rows.filter((row) => row.escrow);
  return <div className="grid gap-4">{withEscrow.map(({ order, escrow }) => <Link key={order.id} href={`/seller/orders/${order.id}`}><Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 text-[var(--tradenest-gold)]" /><div><p className="font-semibold text-[var(--tradenest-navy)]">{order.orderNumber}</p><p className="mt-1 text-xs text-[var(--tradenest-text-secondary)]">Order {order.status.replaceAll('_', ' ')}</p></div></div>{escrow ? <div className="flex items-center gap-4"><Badge tone={escrow.status === 'RELEASED' ? 'success' : escrow.status === 'REFUNDED' ? 'danger' : 'escrow'}>{escrow.status.replaceAll('_', ' ')}</Badge><strong>{formatMoney(escrow.amount, order.currency)}</strong></div> : null}</div></Card></Link>)}{!withEscrow.length ? <Card className="p-8 text-center text-sm text-[var(--tradenest-text-secondary)]">No seller escrow records are available yet. Escrow is created after verified payment success.</Card> : null}</div>;
}
