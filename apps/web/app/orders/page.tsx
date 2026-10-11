'use client';

import Link from 'next/link';
import { ChevronRight, PackageSearch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BuyerGate } from '@/components/buyer-gate';
import { EmptyState } from '@/components/empty-state';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { OrderBadge } from '@/components/order-badge';
import { apiCollection } from '@/lib/api-client';
import type { OrderSummary } from '@/lib/api-types';
import { formatMoney } from '@/lib/money';

export default function OrdersPage() { return <PageShell eyebrow="Buyer" title="Orders" description="Track authoritative order states and open each order for payment, shipment, escrow, delivery confirmation, review, cancellation, or dispute actions when eligible."><BuyerGate><OrdersContent /></BuyerGate></PageShell>; }

function OrdersContent() {
  const [orders, setOrders] = useState<OrderSummary[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void apiCollection<OrderSummary>('orders?page=1&limit=100').then((response) => setOrders(response.data)).catch((value) => setError(value instanceof Error ? value.message : 'Could not load orders.')).finally(() => setLoading(false)); }, []);
  if (loading) return <LoadingState label="Loading orders…" />;
  if (error) return <ErrorNotice message={error} />;
  if (!orders.length) return <EmptyState icon={PackageSearch} title="No orders yet" description="When checkout creates your first order, its authoritative status will appear here." action={<Link href="/explore"><Button>Explore products</Button></Link>} />;
  return <div className="grid gap-4">{orders.map((order) => <Link key={order.id} href={`/orders/${order.id}`}><Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-[var(--tradenest-navy)]">{order.orderNumber}</h2><OrderBadge status={order.status} /></div><p className="mt-2 text-xs text-[var(--tradenest-text-secondary)]">Created {new Date(order.createdAt).toLocaleString()}</p></div><div className="flex items-center justify-between gap-5 sm:justify-end"><div className="text-right"><p className="font-semibold text-[var(--tradenest-text)]">{formatMoney(order.totalAmount, order.currency)}</p><p className="mt-1 text-xs text-[var(--tradenest-text-secondary)]">Authoritative order total</p></div><ChevronRight className="size-5 text-slate-400" /></div></div></Card></Link>)}</div>;
}
