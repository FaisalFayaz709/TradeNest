'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronLeft, CreditCard, MessageSquareWarning, PackageCheck, RefreshCw, ShieldCheck, Star } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { BuyerGate } from '@/components/buyer-gate';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { OrderBadge } from '@/components/order-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiData, idempotencyKey, jsonData, rememberPaymentId } from '@/lib/api-client';
import { uploadManagedFile } from '@/lib/managed-upload';
import { hostedCheckoutRedirect } from '@/lib/hosted-checkout';
import { useSession } from '@/components/session-provider';
import type { Dispute, Escrow, Order, OrderStatus, Payment, Review, Shipment } from '@/lib/api-types';
import { formatMoney } from '@/lib/money';

type OrderSnapshot = { order: Order; escrow: Escrow | null; shipment: Shipment | null };

async function fetchOrderSnapshot(id: string): Promise<OrderSnapshot> {
  const order = await apiData<Order>(`orders/${encodeURIComponent(id)}`);
  const [escrow, shipment] = await Promise.all([
    apiData<Escrow>(`orders/${encodeURIComponent(id)}/escrow`).catch(() => null),
    apiData<Shipment>(`orders/${encodeURIComponent(id)}/shipment`).catch(() => null),
  ]);
  return { order, escrow, shipment };
}

export function OrderDetailClient() {
  const params = useParams<{ id: string }>();
  const id = params.id || '';
  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
      <BuyerGate>
        <Suspense fallback={<LoadingState label="Loading order…" />}>
          {id ? <Detail key={id} id={id} /> : <ErrorNotice message="Order not found." />}
        </Suspense>
      </BuyerGate>
    </main>
  );
}

function Detail({ id }: { id: string }) {
  const { user } = useSession();
  const searchParams = useSearchParams();
  const gatewayReturn = searchParams.has('payment');
  const [order, setOrder] = useState<Order | null>(null);
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const deliveryKey = useRef<string | null>(null);
  const paymentKey = useRef<string | null>(null);

  const applySnapshot = useCallback((next: OrderSnapshot) => {
    setOrder(next.order);
    setEscrow(next.escrow);
    setShipment(next.shipment);
  }, []);

  // Initial load is asynchronous and guarded against navigating away before requests finish.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const next = await fetchOrderSnapshot(id);
        if (active) applySnapshot(next);
      } catch (value) {
        if (active) setError(value instanceof Error ? value.message : 'Could not load order.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id, applySnapshot]);

  // Explicit user-initiated status refresh: never treats a gateway return as payment proof.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applySnapshot(await fetchOrderSnapshot(id));
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not refresh order.');
    } finally {
      setLoading(false);
    }
  }, [id, applySnapshot]);

  async function performAction(action: () => Promise<void>, fallback: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (value) {
      setError(value instanceof Error ? value.message : fallback);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function cancel() {
    if (busyRef.current || !window.confirm('Request cancellation? The backend will reject this if the payment or order state is not eligible.')) return;
    await performAction(async () => {
      await jsonData<Order>(`orders/${id}/cancel`, 'POST');
      await load();
    }, 'Could not cancel order.');
  }

  async function confirmDelivery() {
    await performAction(async () => {
      deliveryKey.current ||= idempotencyKey('confirm-delivery');
      await jsonData<Order>(`orders/${id}/confirm-delivery`, 'POST', undefined, { 'Idempotency-Key': deliveryKey.current });
      deliveryKey.current = null;
      await load();
    }, 'Could not confirm delivery.');
  }

  async function startPayment() {
    await performAction(async () => {
      paymentKey.current ||= idempotencyKey('payment');
      const result = await jsonData<{ payment: Payment; checkoutUrl?: string }>(`orders/${id}/payments`, 'POST', undefined, { 'Idempotency-Key': paymentKey.current });
      const checkoutUrl = hostedCheckoutRedirect(result.payment.provider, result.checkoutUrl);
      setPayment(result.payment);
      if (user) rememberPaymentId(result.payment.id, user.id);
      paymentKey.current = null;
      if (checkoutUrl) window.location.assign(checkoutUrl);
    }, 'Could not create payment.');
  }

  if (loading) return <LoadingState label="Loading order…" />;
  if (error && !order) return <ErrorNotice message={error} />;
  if (!order) return <ErrorNotice message="Order not found." />;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="flex min-w-0 flex-col gap-4 border-b border-[var(--tradenest-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href="/orders" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--tradenest-blue)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--tradenest-focus)]"><ChevronLeft aria-hidden="true" className="size-4" />All orders</Link>
          <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="min-w-0 break-all text-2xl font-semibold tracking-tight text-[var(--tradenest-navy)] sm:text-3xl">{order.orderNumber}</h1><OrderBadge status={order.status} /></div>
          <p className="mt-2 text-sm text-[var(--tradenest-text-secondary)]">Placed {new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {order.status === 'PENDING_PAYMENT' ? <Button className="flex-1 sm:flex-none" onClick={() => void startPayment()} disabled={busy}><CreditCard aria-hidden="true" className="size-4" />{busy ? 'Working…' : 'Pay for order'}</Button> : null}
          {order.status === 'SHIPPED' ? <Button className="flex-1 sm:flex-none" onClick={() => void confirmDelivery()} disabled={busy}><PackageCheck aria-hidden="true" className="size-4" />Confirm delivery</Button> : null}
          {order.status === 'PENDING_PAYMENT' ? <Button className="flex-1 sm:flex-none" variant="outline" onClick={() => void cancel()} disabled={busy}>Cancel order</Button> : null}
          <Button className="flex-1 sm:flex-none" variant="outline" onClick={() => void load()} disabled={busy}><RefreshCw aria-hidden="true" className="size-4" />Refresh status</Button>
        </div>
      </div>

      {error ? <ErrorNotice message={error} /> : null}
      <OrderJourney status={order.status} />

      {payment ? (
        <Card role="status" aria-live="polite" className="min-w-0 border-[var(--tradenest-gold)] bg-[var(--tradenest-gold-light)] p-4 sm:p-5">
          <p className="font-semibold text-[var(--tradenest-navy)]">Payment request created — not confirmed</p>
          <p className="mt-1 break-all text-xs text-[var(--tradenest-text-secondary)]">{payment.provider} · {payment.providerPaymentId} · {payment.status}</p>
          <p className="mt-2 text-sm text-[var(--tradenest-text-secondary)]">Only the backend can verify a provider payment and update the order or escrow.</p>
          <Link href="/payments" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--tradenest-blue)] hover:underline">View payment records</Link>
        </Card>
      ) : null}
      {gatewayReturn ? (
        <Card className="min-w-0 border-[var(--tradenest-gold)] p-4 sm:p-5">
          <p className="font-semibold text-[var(--tradenest-navy)]">Returned from payment provider</p>
          <p className="mt-2 text-sm leading-6 text-[var(--tradenest-text-secondary)]">This redirect is not proof of payment. An authenticated provider webhook must be verified by the backend before order status changes.</p>
          <Button className="mt-3 w-full sm:w-auto" variant="outline" onClick={() => void load()} disabled={busy}><RefreshCw aria-hidden="true" className="size-4" />Check updated status</Button>
        </Card>
      ) : null}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(290px,360px)] lg:items-start lg:gap-6">
        <div className="min-w-0 space-y-5">
          <Card className="min-w-0 p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Items in this order</h2>
            <div className="mt-4 grid gap-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex min-w-0 flex-col gap-2 border-b border-[var(--tradenest-border)] pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0"><p className="break-words font-semibold text-[var(--tradenest-text)]">{item.productName}</p><p className="mt-1 break-all text-xs text-[var(--tradenest-text-secondary)]">SKU {item.sku}</p><p className="mt-1 text-xs text-[var(--tradenest-text-secondary)]">{item.quantity} × {formatMoney(item.unitPrice, order.currency)}</p></div>
                  <strong className="shrink-0 text-sm text-[var(--tradenest-navy)]">{formatMoney(item.totalPrice, order.currency)}</strong>
                </div>
              ))}
            </div>
          </Card>
          <Card className="min-w-0 p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Delivery address</h2>
            <address className="mt-3 break-words text-sm not-italic leading-6 text-[var(--tradenest-text-secondary)]">
              {order.shippingAddress.recipient}<br />{order.shippingAddress.line1}
              {order.shippingAddress.line2 ? <><br />{order.shippingAddress.line2}</> : null}<br />
              {order.shippingAddress.city}{order.shippingAddress.region ? `, ${order.shippingAddress.region}` : ''} {order.shippingAddress.postalCode || ''}<br />{order.shippingAddress.country}
            </address>
          </Card>
          {shipment ? (
            <Card className="min-w-0 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2"><PackageCheck aria-hidden="true" className="size-5 text-[var(--tradenest-teal)]" /><h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Shipment</h2><Badge tone="success">{shipment.status}</Badge></div>
              <p className="mt-3 break-words text-sm text-[var(--tradenest-text-secondary)]">{shipment.carrier} · Tracking <strong className="break-all text-[var(--tradenest-navy)]">{shipment.trackingCode}</strong></p>
              <p className="mt-2 text-xs text-[var(--tradenest-text-secondary)]">Shipped {new Date(shipment.shippedAt).toLocaleString()}{shipment.deliveredAt ? ` · Delivered ${new Date(shipment.deliveredAt).toLocaleString()}` : ''}</p>
            </Card>
          ) : null}
          {order.status === 'COMPLETED' ? <ReviewSection order={order} /> : null}
          {['PAID', 'PROCESSING', 'SHIPPED'].includes(order.status) ? <DisputeSection orderId={order.id} dispute={dispute} setDispute={setDispute} /> : null}
        </div>
        <aside className="min-w-0 space-y-5 lg:sticky lg:top-24">
          <Card className="p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Order summary</h2>
            <p className="mt-1 text-xs text-[var(--tradenest-text-secondary)]">Authoritative backend totals</p>
            <div className="mt-4 grid gap-3 text-sm"><Row label="Subtotal" value={formatMoney(order.subtotal, order.currency)} /><Row label="Shipping" value={formatMoney(order.shippingAmount, order.currency)} /><Row label="Discount" value={`− ${formatMoney(order.discountAmount, order.currency)}`} /><div className="my-1 border-t border-[var(--tradenest-border)]" /><Row label="Total" value={formatMoney(order.totalAmount, order.currency)} strong /></div>
          </Card>
          <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="size-5 text-[var(--tradenest-gold)]" /><h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Escrow status</h2></div>
            {escrow ? <><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><Badge tone={escrow.status === 'RELEASED' ? 'success' : escrow.status === 'REFUNDED' ? 'danger' : 'escrow'}>{escrow.status.replaceAll('_', ' ')}</Badge><strong>{formatMoney(escrow.amount, order.currency)}</strong></div><EscrowTimeline escrow={escrow} /></> : <p className="mt-3 text-sm leading-6 text-[var(--tradenest-text-secondary)]">Escrow information is not currently available. Funds are held only after backend-verified payment.</p>}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function OrderJourney({ status }: { status: OrderStatus }) {
  const steps: Array<{ status: OrderStatus; label: string }> = [
    { status: 'PENDING_PAYMENT', label: 'Payment pending' },
    { status: 'PAID', label: 'Payment verified' },
    { status: 'PROCESSING', label: 'Preparing order' },
    { status: 'SHIPPED', label: 'Shipped' },
    { status: 'DELIVERED', label: 'Delivered' },
    { status: 'COMPLETED', label: 'Completed' },
  ];
  const currentIndex = steps.findIndex((step) => step.status === status);
  if (currentIndex < 0) {
    return <Card className="p-4 sm:p-5"><h2 className="text-sm font-semibold text-[var(--tradenest-navy)]">Order update</h2><p className="mt-2 text-sm text-[var(--tradenest-text-secondary)]">Current backend status: <strong>{status.replaceAll('_', ' ')}</strong>. Open the details below for available actions.</p></Card>;
  }
  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-[var(--tradenest-navy)]">Order progress</h2><span className="text-xs text-[var(--tradenest-text-secondary)]">As reported by TradeNest</span></div>
      <ol className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-6" aria-label="Order progress stages">
        {steps.map((step, index) => (
          <li key={step.status} aria-current={index === currentIndex ? 'step' : undefined} className="min-w-0 text-xs">
            <div className={`mb-2 h-1.5 rounded-full ${index <= currentIndex ? 'bg-[var(--tradenest-teal)]' : 'bg-slate-200'}`} aria-hidden="true" />
            <span className={index === currentIndex ? 'font-bold text-[var(--tradenest-navy)]' : 'text-[var(--tradenest-text-secondary)]'}>{step.label}</span>
          </li>
        ))}
      </ol>
      {status === 'PENDING_PAYMENT' ? <p className="mt-4 text-xs leading-5 text-[var(--tradenest-text-secondary)]">Your order is awaiting backend-verified payment; returning from a provider does not mean it is paid.</p> : null}
    </Card>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className={`flex justify-between gap-4 ${strong ? 'font-semibold text-[var(--tradenest-navy)]' : ''}`}><span className={strong ? '' : 'text-[var(--tradenest-text-secondary)]'}>{label}</span><span>{value}</span></div>; }

function EscrowTimeline({ escrow }: { escrow: Escrow }) {
  const stages = ['HELD', 'SELLER_SHIPPED', 'BUYER_CONFIRMED', 'RELEASED'];
  const index = stages.indexOf(escrow.status);
  const dispute = ['DISPUTED', 'UNDER_REVIEW', 'REFUNDED'].includes(escrow.status);
  return <div className="mt-5 grid gap-3">{stages.map((stage, stageIndex) => <div key={stage} className="flex items-center gap-3 text-xs"><span className={`flex size-6 items-center justify-center rounded-full border ${stageIndex <= index ? 'border-[var(--tradenest-success)] bg-green-50 text-[var(--tradenest-success)]' : 'border-[var(--tradenest-border)] bg-white text-slate-400'}`}>{stageIndex <= index ? <CheckCircle2 className="size-3.5" /> : stageIndex + 1}</span><span className={stageIndex <= index ? 'font-semibold text-[var(--tradenest-text)]' : 'text-[var(--tradenest-text-secondary)]'}>{stage.replaceAll('_', ' ')}</span></div>)}{dispute ? <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-800"><AlertTriangle className="size-4" />Dispute branch: {escrow.status.replaceAll('_', ' ')}</div> : null}</div>;
}

function DisputeSection({ orderId, dispute, setDispute }: { orderId: string; dispute: Dispute | null; setDispute: (value: Dispute) => void }) {
  const [reason, setReason] = useState(''); const [description, setDescription] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [file, setFile] = useState<File | null>(null);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(null); try { setDispute(await jsonData<Dispute>(`orders/${orderId}/disputes`, 'POST', { reason, description })); } catch (value) { setError(value instanceof Error ? value.message : 'Could not open dispute.'); } finally { setBusy(false); } }
  async function evidence(event: FormEvent) {
    event.preventDefault(); if (!dispute || !file) return;
    setBusy(true); setError(null);
    try {
      const objectKey = await uploadManagedFile('disputes', dispute.id, file);
      await jsonData(`disputes/${dispute.id}/evidence`, 'POST', { objectKey, fileName: file.name, mimeType: file.type });
      setDispute(await apiData<Dispute>(`disputes/${dispute.id}`)); setFile(null);
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not upload evidence.'); }
    finally { setBusy(false); }
  }
  if (dispute) return <Card className="p-5"><div className="flex items-center gap-2"><MessageSquareWarning className="size-5 text-amber-600" /><h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Dispute opened</h2><Badge tone="warning">{dispute.status}</Badge></div><p className="mt-3 text-sm font-medium">{dispute.reason}</p><p className="mt-1 text-sm leading-6 text-[var(--tradenest-text-secondary)]">{dispute.description}</p><p className="mt-3 text-xs text-[var(--tradenest-text-secondary)]">Automatic escrow release is blocked while an active dispute is under review.</p>
    {dispute.evidence.length ? <div className="mt-3 grid gap-1">{dispute.evidence.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="text-sm text-[var(--tradenest-blue)] underline">{item.fileName || 'Evidence attachment'}</a>)}</div> : null}
    {dispute.status === 'OPEN' ? <form onSubmit={evidence} className="mt-4 grid gap-3 border-t border-[var(--tradenest-border)] pt-4">
      <label className="grid gap-1 text-sm font-medium">Upload supporting evidence (JPEG, PNG, WebP or PDF; 10 MB max)
        <Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} required />
      </label>
      {error ? <ErrorNotice message={error} /> : null}
      <Button type="submit" variant="outline" disabled={busy || !file}>{busy ? 'Uploading…' : 'Upload evidence'}</Button>
    </form> : null}
  </Card>;
  return <Card className="p-5"><div className="flex items-center gap-2"><MessageSquareWarning className="size-5 text-amber-600" /><h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Open a dispute</h2></div><p className="mt-2 text-xs leading-5 text-[var(--tradenest-text-secondary)]">The backend decides eligibility. Opening an eligible dispute moves escrow into the dispute branch and blocks automatic release.</p><form onSubmit={submit} className="mt-4 grid gap-3"><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" maxLength={255} required /><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the issue…" maxLength={5000} required />{error ? <ErrorNotice message={error} /> : null}<Button type="submit" variant="outline" disabled={busy}>{busy ? 'Opening dispute…' : 'Open dispute'}</Button></form></Card>;
}

function ReviewSection({ order }: { order: Order }) {
  const [selected, setSelected] = useState(order.items[0]?.id || ''); const [rating, setRating] = useState(5); const [comment, setComment] = useState(''); const [result, setResult] = useState<Review | null>(null); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(null); try { setResult(await jsonData<Review>(`orders/${order.id}/reviews`, 'POST', { orderItemId: selected, rating, ...(comment.trim() ? { comment: comment.trim() } : {}) })); } catch (value) { setError(value instanceof Error ? value.message : 'Could not submit review.'); } finally { setBusy(false); } }
  return <Card className="p-5"><div className="flex items-center gap-2"><Star className="size-5 text-[var(--tradenest-gold)]" /><h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Review a completed purchase</h2></div>{result ? <p className="mt-3 text-sm font-medium text-[var(--tradenest-success)]">Review submitted with rating {result.rating}/5. You can choose another purchased item below.</p> : null}<form onSubmit={submit} className="mt-4 grid gap-3"><select value={selected} onChange={(event) => setSelected(event.target.value)} className="h-11 rounded-[var(--tradenest-radius-control)] border border-[var(--tradenest-border)] bg-white px-3 text-sm">{order.items.map((item) => <option key={item.id} value={item.id}>{item.productName}</option>)}</select><label className="text-sm font-medium">Rating <select value={rating} onChange={(event) => setRating(Number(event.target.value))} className="ml-2 rounded-lg border border-[var(--tradenest-border)] bg-white px-2 py-1">{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Optional review comment" />{error ? <ErrorNotice message={error} /> : null}<Button type="submit" variant="outline" disabled={busy}>{busy ? 'Submitting…' : 'Submit verified-purchase review'}</Button></form></Card>;
}
