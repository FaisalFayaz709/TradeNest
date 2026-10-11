'use client';

import Link from 'next/link';
import { ChevronRight, PackageSearch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SellerShell } from '@/components/seller/seller-shell';
import { EmptyState } from '@/components/empty-state';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { OrderBadge } from '@/components/order-badge';
import { Card } from '@/components/ui/card';
import type { OrderSummary } from '@/lib/api-types';
import { allSellerOrders } from '@/lib/seller-data';
import { formatMoney } from '@/lib/money';

export default function SellerOrdersPage() { return <SellerShell title="Orders" description="Seller-owned orders are returned by the dedicated read-only seller collection. Open an order to inspect items, escrow, shipment, and fulfillment eligibility."><Orders /></SellerShell>; }
function Orders() {
  const [orders, setOrders] = useState<OrderSummary[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void allSellerOrders().then(setOrders).catch((value) => setError(value instanceof Error ? value.message : 'Could not load seller orders.')).finally(() => setLoading(false)); }, []);
  if (loading) return <LoadingState label="Loading seller orders…" />;
  if (error) return <ErrorNotice message={error} />;
  if (!orders.length) return <EmptyState icon={PackageSearch} title="No seller orders yet" description="Orders containing your product snapshots will appear here after buyer checkout." />;
  return <div className="grid gap-4">{orders.map((order) => <Link key={order.id} href={`/seller/orders/${order.id}`}><Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-[var(--tradenest-navy)]">{order.orderNumber}</h2><OrderBadge status={order.status} /></div><p className="mt-2 text-xs text-[var(--tradenest-text-secondary)]">Created {new Date(order.createdAt).toLocaleString()}</p></div><div className="flex items-center gap-5"><div className="text-right"><p className="font-semibold">{formatMoney(order.totalAmount, order.currency)}</p><p className="text-xs text-[var(--tradenest-text-secondary)]">Order total</p></div><ChevronRight className="size-5 text-slate-400" /></div></div></Card></Link>)}</div>;
}
