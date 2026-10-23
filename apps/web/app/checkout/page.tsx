'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, MapPin, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BuyerGate } from '@/components/buyer-gate';
import { useSession } from '@/components/session-provider';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { PageShell } from '@/components/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiData, idempotencyKey, jsonData, rememberPaymentId } from '@/lib/api-client';
import { hostedCheckoutRedirect } from '@/lib/hosted-checkout';
import type { Address, CheckoutCreated, CheckoutQuote, Payment } from '@/lib/api-types';
import { formatMoney } from '@/lib/money';

export default function CheckoutPage() {
  return (
    <PageShell
      eyebrow="Secure checkout"
      title="Review your order"
      description="Review the latest quote and choose a delivery address before creating your order. Prices, totals and inventory are verified by the backend."
    >
      <BuyerGate><CheckoutContent /></BuyerGate>
    </PageShell>
  );
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
  const submitting = useRef(false);

  // Quote and addresses are loaded once per mounted checkout, without a synchronous effect state update.
  useEffect(() => {
    let active = true;
    void Promise.all([
      jsonData<CheckoutQuote>('checkout/quote', 'POST'),
      apiData<Address[]>('users/me/addresses'),
    ])
      .then(([nextQuote, nextAddresses]) => {
        if (!active) return;
        setQuote(nextQuote);
        setAddresses(nextAddresses);
        setAddressId((current) => current || nextAddresses[0]?.id || '');
      })
      .catch((value: unknown) => {
        if (active) setError(value instanceof Error ? value.message : 'Could not create checkout quote.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function createOrder() {
    if (submitting.current || created) return;
    if (!addressId || !addresses.some((address) => address.id === addressId)) {
      setError('Choose or create a shipping address first.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    checkoutKey.current ||= idempotencyKey('checkout');
    try {
      const result = await jsonData<CheckoutCreated>(
        'checkout',
        'POST',
        { shippingAddressId: addressId },
        { 'Idempotency-Key': checkoutKey.current },
      );
      setCreated(result);
      if (user) rememberPaymentId(result.payment.id, user.id);
      checkoutKey.current = null;
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Checkout could not be created.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function initiatePayment() {
    if (!created || submitting.current || payment) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    paymentKey.current ||= idempotencyKey('payment');
    try {
      const result = await jsonData<{ payment: Payment; checkoutUrl?: string }>(
        `orders/${created.order.id}/payments`,
        'POST',
        undefined,
        { 'Idempotency-Key': paymentKey.current },
      );
      const checkoutUrl = hostedCheckoutRedirect(result.payment.provider, result.checkoutUrl);
      setPayment(result.payment);
      if (user) rememberPaymentId(result.payment.id, user.id);
      paymentKey.current = null;
      if (checkoutUrl) window.location.assign(checkoutUrl);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Payment could not be initiated.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Requesting authoritative checkout quote…" />;

  if (!quote) return (
    <div className="mx-auto max-w-xl space-y-4">
      <ErrorNotice message={error || 'A checkout quote is not available right now.'} />
      <Button variant="outline" asChild><Link href="/cart"><ArrowLeft aria-hidden="true" className="size-4" />Return to cart</Link></Button>
    </div>
  );

  if (created) return (
    <div className="mx-auto max-w-3xl">
      <Card className="overflow-hidden p-5 sm:p-8">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-green-50 text-[var(--tradenest-success)]"><CheckCircle2 aria-hidden="true" className="size-7" /></div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.15em] text-[var(--tradenest-teal-ink)]">Checkout submitted</p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--tradenest-navy)] sm:text-3xl">Your order has been created</h2>
        <p className="mt-3 break-words text-sm leading-6 text-[var(--tradenest-text-secondary)]">Order <strong>{created.order.orderNumber}</strong> is currently <strong>{created.order.status}</strong>. Inventory was reserved by the backend transaction. Payment has <strong>not</strong> been confirmed.</p>
        <div className="mt-6 grid gap-4 rounded-xl border border-[var(--tradenest-border)] bg-slate-50 p-4 sm:grid-cols-2">
          <Summary label="Authoritative total" value={formatMoney(created.order.totalAmount, created.order.currency)} strong />
          <Summary label="Payment status" value={payment?.status || created.payment.status} />
        </div>
        {error ? <div className="mt-5"><ErrorNotice message={error} /></div> : null}
        {payment ? (
          <div className="mt-5 rounded-xl border border-[var(--tradenest-gold)] bg-[var(--tradenest-gold-light)] p-4">
            <h3 className="flex items-center gap-2 font-semibold text-[var(--tradenest-navy)]"><CreditCard aria-hidden="true" className="size-5" />Provider payment initiated</h3>
            <p className="mt-2 break-all text-xs leading-5 text-[var(--tradenest-text-secondary)]">Provider: {payment.provider} · Reference: {payment.providerPaymentId}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--tradenest-text-secondary)]">TradeNest keeps payment pending until the provider result is verified by the backend. See your order for the latest state.</p>
          </div>
        ) : (
          <div className="mt-5">
            <Button size="lg" className="w-full sm:w-auto" onClick={() => void initiatePayment()} disabled={busy}>
              <CreditCard aria-hidden="true" className="size-4" />{busy ? 'Starting payment…' : 'Continue to payment'}
            </Button>
            <p className="mt-2 text-xs leading-5 text-[var(--tradenest-text-secondary)]">A payment provider may open in a new page. The order remains pending until verified.</p>
          </div>
        )}
        <div className="mt-7 flex flex-col gap-3 border-t border-[var(--tradenest-border)] pt-5 sm:flex-row">
          <Button variant="outline" asChild><Link href={`/orders/${created.order.id}`}>View order <ArrowRight aria-hidden="true" className="size-4" /></Link></Button>
          <Button variant="ghost" asChild><Link href="/payments">Payment status</Link></Button>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(290px,380px)] lg:gap-7">
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/cart" className="inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--tradenest-blue)] hover:underline"><ArrowLeft aria-hidden="true" className="size-4" />Back to cart</Link>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--tradenest-text-secondary)]"><ShieldCheck aria-hidden="true" className="size-4 text-[var(--tradenest-teal)]" />Verified backend quote</span>
        </div>
        <Card className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Order items</h2><Badge tone="escrow">Backend calculated</Badge></div>
          <div className="mt-5 divide-y divide-[var(--tradenest-border)]">
            {quote.items.map((item) => (
              <div key={item.productId} className="flex min-w-0 flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold text-[var(--tradenest-navy)]">{item.productName}</h3><p className="mt-1 text-xs text-[var(--tradenest-text-secondary)]">{item.quantity} × {formatMoney(item.unitPrice, quote.currency)}</p></div>
                <strong className="break-words text-right text-sm tabular-nums text-[var(--tradenest-navy)]">{formatMoney(item.lineTotal, quote.currency)}</strong>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-2"><MapPin aria-hidden="true" className="size-5 text-[var(--tradenest-teal)]" /><h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Delivery address</h2></div>
          {addresses.length ? (
            <fieldset className="mt-4 grid gap-3">
              <legend className="sr-only">Select shipping address</legend>
              {addresses.map((address) => (
                <label key={address.id} className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-[var(--tradenest-focus)] ${addressId === address.id ? 'border-[var(--tradenest-teal)] bg-[var(--tradenest-teal-light)]/40' : 'border-[var(--tradenest-border)] hover:bg-slate-50'}`}>
                  <input type="radio" name="shippingAddress" value={address.id} checked={addressId === address.id} disabled={busy} onChange={() => setAddressId(address.id)} className="mt-1 size-4 shrink-0 accent-[var(--tradenest-teal)]" />
                  <span className="min-w-0 break-words text-sm leading-6"><strong className="text-[var(--tradenest-navy)]">{address.label || address.recipient}</strong><span className="block">{address.recipient}</span><span className="block">{address.line1}{address.line2 ? `, ${address.line2}` : ''}</span><span className="block">{address.city}{address.region ? `, ${address.region}` : ''} {address.postalCode || ''} · {address.country}</span></span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Add a shipping address to continue with your order.</p>
          )}
          <Link href="/profile" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--tradenest-blue)] hover:underline">{addresses.length ? 'Manage addresses' : 'Add shipping address'} <ArrowRight aria-hidden="true" className="ml-2 size-4" /></Link>
        </Card>
      </div>

      <aside aria-label="Checkout summary" className="min-w-0 lg:sticky lg:top-24">
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Total to review</h2>
          <div className="mt-5 space-y-3 text-sm">
            <Summary label="Subtotal" value={formatMoney(quote.subtotalAmount, quote.currency)} />
            <Summary label="Shipping" value={formatMoney(quote.shippingAmount, quote.currency)} />
            <Summary label="Discount" value={`− ${formatMoney(quote.discountAmount, quote.currency)}`} />
            <div className="border-t border-[var(--tradenest-border)] pt-4"><Summary label="Authoritative total" value={formatMoney(quote.totalAmount, quote.currency)} strong /></div>
          </div>
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-[var(--tradenest-text-secondary)]">The quote does <strong>not</strong> reserve stock. Stock and seller eligibility are revalidated during order creation.</p>
          {error ? <div className="mt-4"><ErrorNotice message={error} /></div> : null}
          <Button size="lg" className="mt-5 w-full" disabled={busy || !addressId} onClick={() => void createOrder()}>
            {busy ? 'Creating order…' : 'Create order'}<ArrowRight aria-hidden="true" className="size-4" />
          </Button>
          <p className="mt-3 text-center text-xs leading-5 text-[var(--tradenest-text-secondary)]">Creating an order does not confirm payment. You&apos;ll continue to your configured provider next.</p>
        </Card>
      </aside>
    </div>
  );
}

function Summary({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center justify-between gap-3 ${strong ? 'text-base font-semibold text-[var(--tradenest-navy)]' : ''}`}>
      <span className={strong ? '' : 'text-[var(--tradenest-text-secondary)]'}>{label}</span>
      <span className="break-words text-right tabular-nums">{value}</span>
    </div>
  );
}
