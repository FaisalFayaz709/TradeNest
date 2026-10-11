'use client';

import Link from 'next/link';
import { CheckCircle2, CreditCard, MapPin, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BuyerGate } from '@/components/buyer-gate';
import { hostedCheckoutRedirect } from '@/lib/hosted-checkout';
import { useSession } from '@/components/session-provider';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { PageShell } from '@/components/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiData, idempotencyKey, jsonData, rememberPaymentId } from '@/lib/api-client';
import type { Address, CheckoutCreated, CheckoutQuote, Payment } from '@/lib/api-types';
import { formatMoney } from '@/lib/money';

export default function CheckoutPage() {
  return <PageShell eyebrow="Protected transaction" title="Checkout" description="The quote below comes from the authoritative NestJS checkout service. The browser does not submit trusted prices or totals."><BuyerGate><CheckoutContent /></BuyerGate></PageShell>;
}

function CheckoutContent() {
  const { user } = useSession();
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState('');
  const [created, setCreated] = useState<CheckoutCreated | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkoutKey = useRef<string | null>(null);
  const paymentKey = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [nextQuote, nextAddresses] = await Promise.all([jsonData<CheckoutQuote>('checkout/quote', 'POST'), apiData<Address[]>('users/me/addresses')]);
      setQuote(nextQuote); setAddresses(nextAddresses); setAddressId((current) => current || nextAddresses[0]?.id || '');
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not create checkout quote.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function createOrder() {
    if (!addressId) { setError('Choose or create a shipping address first.'); return; }
    setBusy(true); setError(null);
    checkoutKey.current ||= idempotencyKey('checkout');
    try {
      const result = await jsonData<CheckoutCreated>('checkout', 'POST', { shippingAddressId: addressId }, { 'Idempotency-Key': checkoutKey.current });
      setCreated(result); if (user) rememberPaymentId(result.payment.id, user.id); checkoutKey.current = null;
    } catch (value) { setError(value instanceof Error ? value.message : 'Checkout could not be created.'); }
    finally { setBusy(false); }
  }

  async function initiatePayment() {
    if (!created) return;
    setBusy(true); setError(null);
    paymentKey.current ||= idempotencyKey('payment');
    try {
      const result = await jsonData<{ payment: Payment; checkoutUrl?: string }>(`orders/${created.order.id}/payments`, 'POST', undefined, { 'Idempotency-Key': paymentKey.current });
      const checkoutUrl = hostedCheckoutRedirect(result.payment.provider, result.checkoutUrl);
      setPayment(result.payment); if (user) rememberPaymentId(result.payment.id, user.id); paymentKey.current = null;
      if (checkoutUrl) window.location.assign(checkoutUrl);
    } catch (value) { setError(value instanceof Error ? value.message : 'Payment could not be initiated.'); }
    finally { setBusy(false); }
  }

  if (loading) return <LoadingState label="Requesting authoritative checkout quote…" />;
  if (!quote && error) return <><ErrorNotice message={error} /><div className="mt-4"><Link href="/cart"><Button variant="outline">Return to cart</Button></Link></div></>;
  if (!quote) return null;

  if (created) return <div className="mx-auto max-w-3xl"><Card className="p-6 sm:p-8"><div className="flex size-12 items-center justify-center rounded-full bg-green-50 text-[var(--tradenest-success)]"><CheckCircle2 className="size-6" /></div><h2 className="mt-5 text-2xl font-semibold text-[var(--tradenest-navy)]">Order created</h2><p className="mt-2 text-sm leading-6 text-[var(--tradenest-text-secondary)]">Order <strong>{created.order.orderNumber}</strong> is currently <strong>{created.order.status}</strong>. Inventory was reserved transactionally; this interface has not declared payment success.</p><div className="mt-6 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><Summary label="Authoritative total" value={formatMoney(created.order.totalAmount, created.order.currency)} /><Summary label="Payment record" value={payment?.status || created.payment.status} /></div>{error ? <div className="mt-4"><ErrorNotice message={error} /></div> : null}{payment ? <div className="mt-5 rounded-xl border border-[var(--tradenest-gold)] bg-[var(--tradenest-gold-light)] p-4"><div className="flex items-center gap-2 font-semibold text-[var(--tradenest-navy)]"><CreditCard className="size-4" />Provider payment created</div><p className="mt-2 break-all text-xs leading-5 text-[var(--tradenest-text-secondary)]">Provider: {payment.provider} · Provider payment ID: {payment.providerPaymentId}</p><p className="mt-2 text-xs leading-5 text-[var(--tradenest-text-secondary)]">TradeNest remains pending until a verified provider webhook establishes the actual payment result.</p></div> : <Button className="mt-5" size="lg" onClick={() => void initiatePayment()} disabled={busy}><CreditCard className="size-4" />{busy ? 'Starting payment…' : 'Create payment with configured provider'}</Button>}<div className="mt-6 flex flex-wrap gap-2"><Link href={`/orders/${created.order.id}`}><Button variant="outline">View order</Button></Link><Link href="/payments"><Button variant="ghost">Payment status</Button></Link></div></Card></div>;

  return <div className="grid gap-6 lg:grid-cols-[1fr_380px]"> <div className="grid gap-6"><Card className="p-5"><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-[var(--tradenest-gold)]" /><h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Authoritative quote</h2><Badge tone="escrow">Backend calculated</Badge></div><div className="mt-5 grid gap-3">{quote.items.map((item) => <div key={item.productId} className="flex justify-between gap-4 border-b border-[var(--tradenest-border)] pb-3 text-sm"><div><p className="font-medium text-[var(--tradenest-text)]">{item.productName}</p><p className="mt-1 text-xs text-[var(--tradenest-text-secondary)]">{item.quantity} × {formatMoney(item.unitPrice, quote.currency)}</p></div><strong>{formatMoney(item.lineTotal, quote.currency)}</strong></div>)}</div></Card><Card className="p-5"><div className="flex items-center gap-2"><MapPin className="size-5 text-[var(--tradenest-teal)]" /><h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Shipping address</h2></div>{addresses.length ? <div className="mt-4 grid gap-3">{addresses.map((address) => <label key={address.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${addressId === address.id ? 'border-[var(--tradenest-teal)] bg-[var(--tradenest-teal-light)]/40' : 'border-[var(--tradenest-border)]'}`}><input type="radio" name="address" value={address.id} checked={addressId === address.id} onChange={() => setAddressId(address.id)} /><span className="text-sm leading-6"><strong>{address.label || address.recipient}</strong><br />{address.line1}{address.line2 ? `, ${address.line2}` : ''}<br />{address.city}{address.region ? `, ${address.region}` : ''} {address.postalCode || ''} · {address.country}</span></label>)}</div> : <p className="mt-3 text-sm text-[var(--tradenest-text-secondary)]">You need a saved address before checkout.</p>}<Link href="/profile" className="mt-4 inline-block text-sm font-semibold text-[var(--tradenest-blue)] hover:underline">Manage addresses →</Link></Card></div><Card className="h-fit p-5 lg:sticky lg:top-24"><h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Order total</h2><div className="mt-4 grid gap-2 text-sm"><Summary label="Subtotal" value={formatMoney(quote.subtotalAmount, quote.currency)} /><Summary label="Shipping" value={formatMoney(quote.shippingAmount, quote.currency)} /><Summary label="Discount" value={`− ${formatMoney(quote.discountAmount, quote.currency)}`} /><div className="my-2 border-t border-[var(--tradenest-border)]" /><Summary label="Total" value={formatMoney(quote.totalAmount, quote.currency)} strong /></div><p className="mt-4 text-xs leading-5 text-[var(--tradenest-text-secondary)]">Inventory is <strong>{quote.inventoryReserved ? 'reserved' : 'not reserved'}</strong> by this quote. Reservation normally happens inside the checkout transaction and can still fail safely under concurrency.</p>{error ? <div className="mt-4"><ErrorNotice message={error} /></div> : null}<Button size="lg" className="mt-5 w-full" disabled={busy || !addressId} onClick={() => void createOrder()}>{busy ? 'Creating order…' : 'Create order'}</Button></Card></div>;
}

function Summary({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className={`flex items-center justify-between gap-4 ${strong ? 'text-base font-semibold text-[var(--tradenest-navy)]' : ''}`}><span className={strong ? '' : 'text-[var(--tradenest-text-secondary)]'}>{label}</span><span>{value}</span></div>; }
