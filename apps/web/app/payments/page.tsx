'use client';

import Link from 'next/link';
import { CreditCard, Search, ShieldCheck } from 'lucide-react';
import { type FormEvent, useRef, useState } from 'react';
import { BuyerGate } from '@/components/buyer-gate';
import { useSession } from '@/components/session-provider';
import { EmptyState } from '@/components/empty-state';
import { ErrorNotice } from '@/components/error-notice';
import { PageShell } from '@/components/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiData, recentPaymentIds } from '@/lib/api-client';
import type { AuthUser, Payment } from '@/lib/api-types';
import { formatMoney } from '@/lib/money';

export default function PaymentsPage() {
  return (
    <PageShell
      eyebrow="Buyer workspace"
      title="Payment history"
      description="Check payments created at checkout. Recent IDs are saved only on this device; every lookup is authorized by the backend."
      action={<Button variant="outline" asChild><Link href="/orders">View your orders</Link></Button>}
    >
      <BuyerGate><BuyerScopedPayments /></BuyerGate>
    </PageShell>
  );
}

function BuyerScopedPayments() {
  const { user } = useSession();
  if (!user || user.role !== 'BUYER') return null;
  // Remount to isolate lookup results when the signed-in buyer changes.
  return <PaymentsContent key={user.id} user={user} />;
}

function PaymentsContent({ user }: { user: AuthUser }) {
  const [paymentId, setPaymentId] = useState('');
  const [recent] = useState<string[]>(() => recentPaymentIds(user.id));
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  async function lookup(id: string) {
    const trimmed = id.trim();
    if (!trimmed || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const value = await apiData<Payment>(`payments/${encodeURIComponent(trimmed)}`);
      setPayments((current) => [value, ...current.filter((item) => item.id !== value.id)]);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Payment not found.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookup(paymentId);
  }

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)] lg:items-start lg:gap-6">
      <Card className="min-w-0 p-4 sm:p-5 lg:sticky lg:top-24">
        <div className="flex items-center gap-2"><Search aria-hidden="true" className="size-5 text-[var(--tradenest-teal)]" /><h2 className="font-semibold text-[var(--tradenest-navy)]">Find a payment</h2></div>
        <form onSubmit={submit} className="mt-4 grid gap-3">
          <label htmlFor="payment-id" className="text-sm font-medium text-[var(--tradenest-text)]">Payment ID</label>
          <Input id="payment-id" value={paymentId} onChange={(event) => setPaymentId(event.target.value)} placeholder="Payment UUID" autoComplete="off" required />
          <Button type="submit" disabled={busy || !paymentId.trim()}><Search aria-hidden="true" className="size-4" />{busy ? 'Looking up…' : 'Look up payment'}</Button>
        </form>
        {recent.length ? (
          <div className="mt-6 border-t border-[var(--tradenest-border)] pt-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--tradenest-text-secondary)]">Recent on this device</p>
            <div className="mt-2 grid gap-1">
              {recent.map((id) => <button key={id} type="button" disabled={busy} onClick={() => { setPaymentId(id); void lookup(id); }} className="min-h-11 min-w-0 truncate rounded-lg px-3 py-2 text-left font-mono text-xs text-[var(--tradenest-blue)] hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[var(--tradenest-focus)] disabled:opacity-50" title={id}>{id}</button>)}
            </div>
          </div>
        ) : <p className="mt-5 text-xs leading-5 text-[var(--tradenest-text-secondary)]">No payment IDs saved on this device. Look up a payment by its exact ID.</p>}
      </Card>

      <div className="min-w-0 space-y-4" aria-live="polite">
        <Card className="flex items-start gap-3 border-[var(--tradenest-border)] bg-slate-50 p-4">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[var(--tradenest-teal)]" />
          <p className="text-sm leading-6 text-[var(--tradenest-text-secondary)]">Payment statuses come from TradeNest&apos;s backend, not the browser or a payment gateway redirect. Payment approval and order fulfilment can update separately.</p>
        </Card>
        {error ? <ErrorNotice message={error} /> : null}
        {payments.length ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-[var(--tradenest-navy)]">Lookup results</h2><button type="button" className="text-sm font-semibold text-[var(--tradenest-blue)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--tradenest-focus)]" onClick={() => { setPayments([]); setError(null); }}>Clear results</button></div>
            <div className="grid gap-4">{payments.map((payment) => <PaymentCard key={payment.id} payment={payment} />)}</div>
          </>
        ) : <EmptyState icon={CreditCard} title="No payment loaded" description="Open a recent payment or enter an exact payment ID. Checkout and your orders are the places to create a payment." />}
      </div>
    </div>
  );
}

function PaymentCard({ payment }: { payment: Payment }) {
  const tone = payment.status === 'SUCCEEDED' ? 'success' : payment.status === 'FAILED' ? 'danger' : 'warning';
  const description = payment.status === 'SUCCEEDED'
    ? 'Payment success is recorded by the backend. Check your order for fulfilment updates.'
    : payment.status === 'FAILED'
      ? 'This payment was not successful. View the order for available next steps.'
      : 'Payment is pending backend/provider verification. A gateway redirect alone does not confirm payment.';

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold text-[var(--tradenest-navy)]">{formatMoney(payment.amount, payment.currency)}</h3><Badge tone={tone}>{payment.status}</Badge></div>
          <p className="mt-2 break-all font-mono text-xs text-[var(--tradenest-text-secondary)]">{payment.id}</p>
          <p className="mt-2 break-words text-xs text-[var(--tradenest-text-secondary)]">Provider: {payment.provider}</p>
        </div>
        <p className="text-xs text-[var(--tradenest-text-secondary)] sm:text-right">{payment.paidAt ? `Recorded ${new Date(payment.paidAt).toLocaleString()}` : `Created ${new Date(payment.createdAt).toLocaleString()}`}</p>
      </div>
      <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-[var(--tradenest-text-secondary)]">{description}</p>
      {payment.failureMessage ? <p className="mt-3 break-words rounded-lg bg-red-50 p-3 text-sm text-red-800">{payment.failureMessage}</p> : null}
      <Button className="mt-4 w-full sm:w-auto" variant="outline" asChild><Link href={`/orders/${encodeURIComponent(payment.orderId)}`}>View related order</Link></Button>
    </Card>
  );
}
