'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, CreditCard, MessageSquareWarning, PackageCheck, ShieldCheck, Star } from 'lucide-react';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
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
import type { Dispute, Escrow, Order, Payment, Review, Shipment } from '@/lib/api-types';
import { formatMoney } from '@/lib/money';

export function OrderDetailClient() {
  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12"><BuyerGate><Detail /></BuyerGate></main>;
}

function Detail() {
  const { user } = useSession();
  const params = useParams<{ id: string }>();
  const id = params.id || '';
  const [order, setOrder] = useState<Order | null>(null);
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gatewayReturn, setGatewayReturn] = useState(false);
  useEffect(() => { setGatewayReturn(new URLSearchParams(window.location.search).has('payment')); }, []);
  const deliveryKey = useRef<string | null>(null);
  const paymentKey = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const value = await apiData<Order>(`orders/${id}`); setOrder(value);
      void apiData<Escrow>(`orders/${id}/escrow`).then(setEscrow).catch(() => setEscrow(null));
      void apiData<Shipment>(`orders/${id}/shipment`).then(setShipment).catch(() => setShipment(null));
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not load order.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function cancel() {
    if (!confirm('Request cancellation for this order? The backend will reject the command if the current financial state is not eligible.')) return;
    setBusy(true); setError(null);
    try { await jsonData<Order>(`orders/${id}/cancel`, 'POST'); await load(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not cancel order.'); }
    finally { setBusy(false); }
  }

  async function confirmDelivery() {
    deliveryKey.current ||= idempotencyKey('confirm-delivery'); setBusy(true); setError(null);
    try { await jsonData<Order>(`orders/${id}/confirm-delivery`, 'POST', undefined, { 'Idempotency-Key': deliveryKey.current }); deliveryKey.current = null; await load(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not confirm delivery.'); }
    finally { setBusy(false); }
  }

  async function startPayment() {
    paymentKey.current ||= idempotencyKey('payment'); setBusy(true); setError(null);
    try {
      const result = await jsonData<{ payment: Payment; checkoutUrl?: string }>(`orders/${id}/payments`, 'POST', undefined, { 'Idempotency-Key': paymentKey.current });
      const checkoutUrl = hostedCheckoutRedirect(result.payment.provider, result.checkoutUrl);
      setPayment(result.payment); if (user) rememberPaymentId(result.payment.id, user.id); paymentKey.current = null;
      if (checkoutUrl) window.location.assign(checkoutUrl);
    }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not create payment.'); }
    finally { setBusy(false); }
  }

  if (loading) return <LoadingState label="Loading order…" />;
  if (error && !order) return <ErrorNotice message={error} />;
  if (!order) return null;

  return <div><div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><Link href="/orders" className="text-sm font-medium text-[var(--tradenest-blue)] hover:underline">← Back to orders</Link><div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight text-[var(--tradenest-navy)]">{order.orderNumber}</h1><OrderBadge status={order.status} /></div><p className="mt-2 text-sm text-[var(--tradenest-text-secondary)]">Created {new Date(order.createdAt).toLocaleString()}</p></div><div className="flex flex-wrap gap-2">{order.status === 'PENDING_PAYMENT' ? <Button onClick={() => void startPayment()} disabled={busy}><CreditCard className="size-4" />Create payment</Button> : null}{order.status === 'SHIPPED' ? <Button onClick={() => void confirmDelivery()} disabled={busy}><PackageCheck className="size-4" />Confirm delivery</Button> : null}{order.status === 'PENDING_PAYMENT' ? <Button variant="outline" onClick={() => void cancel()} disabled={busy}>Cancel order</Button> : null}</div></div>{error ? <div className="mb-5"><ErrorNotice message={error} /></div> : null}{payment ? <Card className="mb-5 border-[var(--tradenest-gold)] bg-[var(--tradenest-gold-light)] p-4"><p className="font-semibold text-[var(--tradenest-navy)]">Payment provider request created</p><p className="mt-1 break-all text-xs text-[var(--tradenest-text-secondary)]">{payment.provider} · {payment.providerPaymentId} · status {payment.status}</p><p className="mt-2 text-xs text-[var(--tradenest-text-secondary)]">This status remains provider/backend controlled; this page does not mark the order paid.</p></Card> : null}

  {gatewayReturn ? <Card className="mb-5 border-[var(--tradenest-gold)] p-4"><p className="text-sm font-medium">Payment gateway return received. Your order will update only after a verified provider webhook; this redirect is not proof of payment.</p><Button className="mt-3" variant="outline" onClick={() => void load()} disabled={busy}>Refresh order status</Button></Card> : null}
  <div className="grid gap-6 lg:grid-cols-[1fr_380px]"><div className="grid gap-6"><Card className="p-5"><h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Items</h2><div className="mt-4 grid gap-4">{order.items.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 border-b border-[var(--tradenest-border)] pb-4 last:border-0 last:pb-0"><div><p className="font-medium text-[var(--tradenest-text)]">{item.productName}</p><p className="mt-1 text-xs text-[var(--tradenest-text-secondary)]">SKU {item.sku} · Quantity {item.quantity} · {formatMoney(item.unitPrice, order.currency)} each</p></div><strong className="text-sm">{formatMoney(item.totalPrice, order.currency)}</strong></div>)}</div></Card><Card className="p-5"><h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Shipping address snapshot</h2><p className="mt-3 text-sm leading-6 text-[var(--tradenest-text-secondary)]">{order.shippingAddress.recipient}<br />{order.shippingAddress.line1}{order.shippingAddress.line2 ? <><br />{order.shippingAddress.line2}</> : null}<br />{order.shippingAddress.city}{order.shippingAddress.region ? `, ${order.shippingAddress.region}` : ''} {order.shippingAddress.postalCode || ''}<br />{order.shippingAddress.country}</p></Card>{shipment ? <Card className="p-5"><div className="flex items-center gap-2"><PackageCheck className="size-5 text-[var(--tradenest-teal)]" /><h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Shipment</h2><Badge tone="success">{shipment.status}</Badge></div><p className="mt-3 text-sm text-[var(--tradenest-text-secondary)]">{shipment.carrier} · Tracking <strong>{shipment.trackingCode}</strong></p><p className="mt-2 text-xs text-[var(--tradenest-text-secondary)]">Shipped {new Date(shipment.shippedAt).toLocaleString()}{shipment.deliveredAt ? ` · Delivered ${new Date(shipment.deliveredAt).toLocaleString()}` : ''}</p></Card> : null}{order.status === 'COMPLETED' ? <ReviewSection order={order} /> : null}{['PAID', 'PROCESSING', 'SHIPPED'].includes(order.status) ? <DisputeSection orderId={order.id} dispute={dispute} setDispute={setDispute} /> : null}</div><div className="grid h-fit gap-6"><Card className="p-5"><h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Authoritative totals</h2><div className="mt-4 grid gap-2 text-sm"><Row label="Subtotal" value={formatMoney(order.subtotal, order.currency)} /><Row label="Shipping" value={formatMoney(order.shippingAmount, order.currency)} /><Row label="Discount" value={`− ${formatMoney(order.discountAmount, order.currency)}`} /><div className="my-2 border-t border-[var(--tradenest-border)]" /><Row label="Total" value={formatMoney(order.totalAmount, order.currency)} strong /></div></Card><Card className="p-5"><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-[var(--tradenest-gold)]" /><h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Escrow</h2></div>{escrow ? <><div className="mt-4 flex items-center justify-between"><Badge tone={escrow.status === 'RELEASED' ? 'success' : escrow.status === 'REFUNDED' ? 'danger' : 'escrow'}>{escrow.status.replaceAll('_', ' ')}</Badge><strong>{formatMoney(escrow.amount, order.currency)}</strong></div><EscrowTimeline escrow={escrow} /></> : <p className="mt-3 text-sm leading-6 text-[var(--tradenest-text-secondary)]">No escrow record is available yet. A verified successful payment is required before funds can enter HELD state.</p>}</Card></div></div></div>;
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
