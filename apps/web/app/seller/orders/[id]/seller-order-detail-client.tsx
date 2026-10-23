'use client';

import Link from 'next/link';
import { PackageCheck, ShieldCheck, Truck } from 'lucide-react';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { SellerShell } from '@/components/seller/seller-shell';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { OrderBadge } from '@/components/order-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiData, jsonData } from '@/lib/api-client';
import type { Escrow, Order, Shipment } from '@/lib/api-types';
import { formatMoney } from '@/lib/money';

export function SellerOrderDetailClient() {
  const params = useParams<{ id: string }>(); const id = params.id || '';
  return <SellerShell title="Order detail" description="Fulfillment commands are sent to NestJS; this screen never declares an order shipped or escrow released on its own."><Detail key={id} id={id} /></SellerShell>;
}

function Detail({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null); const [escrow, setEscrow] = useState<Escrow | null>(null); const [shipment, setShipment] = useState<Shipment | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { const value = await apiData<Order>(`orders/${id}`); setOrder(value); void apiData<Escrow>(`orders/${id}/escrow`).then(setEscrow).catch(() => setEscrow(null)); void apiData<Shipment>(`orders/${id}/shipment`).then(setShipment).catch(() => setShipment(null)); } catch (value) { setError(value instanceof Error ? value.message : 'Could not load seller order.'); } finally { setLoading(false); } }, [id]);
  useEffect(() => {
    let active = true;

    void apiData<Order>(`orders/${id}`)
      .then((value) => {
        if (!active) return;
        setOrder(value);
        setError(null);

        // An order can exist before escrow or shipment records are available.
        // Preserve independent, non-blocking lookups for these optional details.
        void apiData<Escrow>(`orders/${id}/escrow`)
          .then((result) => { if (active) setEscrow(result); })
          .catch(() => { if (active) setEscrow(null); });
        void apiData<Shipment>(`orders/${id}/shipment`)
          .then((result) => { if (active) setShipment(result); })
          .catch(() => { if (active) setShipment(null); });
      })
      .catch((value: unknown) => {
        if (active) setError(value instanceof Error ? value.message : 'Could not load seller order.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);
  if (loading) return <LoadingState label="Loading order…" />;
  if (error && !order) return <ErrorNotice message={error} />;
  if (!order) return null;
  return <div className="grid gap-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><Link href="/seller/orders" className="text-sm font-medium text-[var(--tradenest-blue)] hover:underline">← Back to seller orders</Link><div className="mt-3 flex items-center gap-2"><h2 className="text-2xl font-semibold text-[var(--tradenest-navy)]">{order.orderNumber}</h2><OrderBadge status={order.status} /></div></div>{!shipment && ['PAID', 'PROCESSING'].includes(order.status) ? <ShipmentForm orderId={order.id} onCreated={() => void load()} /> : null}</div>{error ? <ErrorNotice message={error} /> : null}<div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="grid gap-6"><Card className="p-5"><h3 className="font-semibold text-[var(--tradenest-navy)]">Order items</h3><div className="mt-4 grid gap-3">{order.items.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 border-b border-[var(--tradenest-border)] pb-3 last:border-0"><div><p className="font-medium">{item.productName}</p><p className="text-xs text-[var(--tradenest-text-secondary)]">SKU {item.sku} · Qty {item.quantity}</p></div><span className="text-sm font-semibold">{formatMoney(item.totalPrice, order.currency)}</span></div>)}</div></Card><Card className="p-5"><h3 className="font-semibold text-[var(--tradenest-navy)]">Ship to</h3><p className="mt-3 text-sm leading-6 text-[var(--tradenest-text-secondary)]">{order.shippingAddress.recipient}<br />{order.shippingAddress.line1}{order.shippingAddress.line2 ? <><br />{order.shippingAddress.line2}</> : null}<br />{order.shippingAddress.city}{order.shippingAddress.region ? `, ${order.shippingAddress.region}` : ''} {order.shippingAddress.postalCode || ''}<br />{order.shippingAddress.country}</p></Card>{shipment ? <Card className="p-5"><div className="flex items-center gap-2"><PackageCheck className="size-5 text-[var(--tradenest-teal)]" /><h3 className="font-semibold text-[var(--tradenest-navy)]">Shipment</h3><Badge tone="success">{shipment.status}</Badge></div><p className="mt-3 text-sm">{shipment.carrier} · <strong>{shipment.trackingCode}</strong></p><p className="mt-1 text-xs text-[var(--tradenest-text-secondary)]">Shipped {new Date(shipment.shippedAt).toLocaleString()}</p></Card> : null}</div><div className="grid h-fit gap-6"><Card className="p-5"><h3 className="font-semibold text-[var(--tradenest-navy)]">Order total</h3><p className="mt-3 text-2xl font-semibold text-[var(--tradenest-navy)]">{formatMoney(order.totalAmount, order.currency)}</p><p className="mt-1 text-xs text-[var(--tradenest-text-secondary)]">Buyer-authoritative checkout total</p></Card><Card className="p-5"><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-[var(--tradenest-gold)]" /><h3 className="font-semibold text-[var(--tradenest-navy)]">Escrow</h3></div>{escrow ? <><div className="mt-4 flex items-center justify-between"><Badge tone={escrow.status === 'RELEASED' ? 'success' : escrow.status === 'REFUNDED' ? 'danger' : 'escrow'}>{escrow.status.replaceAll('_', ' ')}</Badge><strong>{formatMoney(escrow.amount, order.currency)}</strong></div><p className="mt-3 text-xs leading-5 text-[var(--tradenest-text-secondary)]">Funds are released or refunded only through backend state-machine commands. Seller shipment moves eligible HELD escrow to SELLER_SHIPPED.</p></> : <p className="mt-3 text-sm text-[var(--tradenest-text-secondary)]">No escrow is available for this order yet.</p>}</Card>{order.status === 'DISPUTED' ? <Button variant="outline" className="w-full" asChild><Link href="/seller/disputes">Open disputes workspace</Link></Button> : null}</div></div></div>;
}

function ShipmentForm({ orderId, onCreated }: { orderId: string; onCreated: () => void }) {
  const [carrier, setCarrier] = useState(''); const [trackingCode, setTrackingCode] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(null); try { await jsonData<Shipment>(`orders/${orderId}/shipment`, 'POST', { carrier, trackingCode }); onCreated(); } catch (value) { setError(value instanceof Error ? value.message : 'Could not create shipment.'); } finally { setBusy(false); } }
  return <form onSubmit={submit} className="flex flex-col gap-2 rounded-xl border border-[var(--tradenest-border)] bg-white p-3 sm:flex-row sm:items-end"><label className="grid gap-1 text-xs font-medium">Carrier<Input className="w-40" value={carrier} onChange={(event) => setCarrier(event.target.value)} required /></label><label className="grid gap-1 text-xs font-medium">Tracking code<Input className="w-48" value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} required /></label><Button type="submit" size="sm" disabled={busy}><Truck className="size-4" />{busy ? 'Creating…' : 'Create shipment'}</Button>{error ? <span className="text-xs text-[var(--tradenest-danger)]">{error}</span> : null}</form>;
}
