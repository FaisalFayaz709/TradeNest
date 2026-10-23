'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, PackageSearch } from 'lucide-react';
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
import type { OrderSummary, PaginationMeta } from '@/lib/api-types';
import { formatMoney } from '@/lib/money';

const PAGE_LIMIT = 12;

export default function OrdersPage() {
  return (
    <PageShell
      eyebrow="Buyer workspace"
      title="Your orders"
      description="Review each order's real status, shipment, payment and next steps. Amounts and status updates come from TradeNest's backend."
      action={<Button variant="outline" asChild><Link href="/explore">Continue shopping</Link></Button>}
    >
      <BuyerGate><OrdersContent /></BuyerGate>
    </PageShell>
  );
}

function OrdersContent() {
  const [page, setPage] = useState(1);
  const [retryKey, setRetryKey] = useState(0);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await apiCollection<OrderSummary>(`orders?page=${page}&limit=${PAGE_LIMIT}`);
        if (!active) return;
        setOrders(response.data);
        setMeta(response.meta);
      } catch (value) {
        if (active) setError(value instanceof Error ? value.message : 'Could not load orders.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [page, retryKey]);

  function goToPage(nextPage: number) {
    if (loading || nextPage < 1 || (meta && nextPage > meta.totalPages)) return;
    setLoading(true);
    setError(null);
    setPage(nextPage);
  }

  if (loading) return <LoadingState label="Loading orders…" />;
  if (error) return <div className="grid gap-4"><ErrorNotice message={error} /><Button variant="outline" onClick={() => { setLoading(true); setError(null); setRetryKey((current) => current + 1); }}>Try again</Button></div>;
  if (!orders.length && page === 1) {
    return <EmptyState icon={PackageSearch} title="No orders yet" description="After you check out, your real order and payment statuses will appear here." action={<Button asChild><Link href="/explore">Explore products</Link></Button>} />;
  }

  return (
    <section aria-label="Order history" className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--tradenest-border)] bg-white p-4 sm:px-5">
        <div>
          <p className="text-sm font-semibold text-[var(--tradenest-navy)]">Purchase history</p>
          <p className="mt-1 text-xs text-[var(--tradenest-text-secondary)]">{meta ? `${meta.total} order${meta.total === 1 ? '' : 's'} in your account` : 'Recent orders'}</p>
        </div>
        <p className="rounded-full bg-[var(--tradenest-gold-light)] px-3 py-1.5 text-xs font-semibold text-[var(--tradenest-navy)]">Backend-verified statuses</p>
      </div>
      <div className="grid gap-3 sm:gap-4">
        {orders.map((order) => (
          <Link key={order.id} href={`/orders/${encodeURIComponent(order.id)}`} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tradenest-focus)]">
            <Card className="group min-w-0 p-4 transition hover:border-[var(--tradenest-teal)] hover:shadow-md sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="break-all font-semibold text-[var(--tradenest-navy)]">{order.orderNumber}</h2>
                    <OrderBadge status={order.status} />
                  </div>
                  <p className="mt-2 text-xs text-[var(--tradenest-text-secondary)]">Placed {new Date(order.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                </div>
                <div className="flex items-center justify-between gap-5 border-t border-[var(--tradenest-border)] pt-3 sm:justify-end sm:border-0 sm:pt-0">
                  <div className="sm:text-right">
                    <p className="font-semibold text-[var(--tradenest-navy)]">{formatMoney(order.totalAmount, order.currency)}</p>
                    <p className="mt-1 text-xs text-[var(--tradenest-text-secondary)]">Order total</p>
                  </div>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-[var(--tradenest-blue)] transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      {meta && meta.totalPages > 1 ? (
        <nav aria-label="Order pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--tradenest-border)] pt-5">
          <p className="text-sm text-[var(--tradenest-text-secondary)]">Page {meta.page} of {meta.totalPages}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={page <= 1 || loading} onClick={() => goToPage(page - 1)}><ChevronLeft aria-hidden="true" className="size-4" />Previous</Button>
            <Button type="button" variant="outline" disabled={page >= meta.totalPages || loading} onClick={() => goToPage(page + 1)}>Next<ChevronRight aria-hidden="true" className="size-4" /></Button>
          </div>
        </nav>
      ) : null}
    </section>
  );
}
