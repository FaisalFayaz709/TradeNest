'use client';

import { CreditCard, Search } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
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
import type { Payment } from '@/lib/api-types';
import { formatMoney } from '@/lib/money';

export default function PaymentsPage() { return <PageShell eyebrow="Buyer" title="Payments" description="Inspect payment records you created during checkout. TradeNest does not currently expose a buyer-wide payment-list endpoint, so this screen keeps recent payment IDs locally and supports exact-ID lookup."><BuyerGate><PaymentsContent /></BuyerGate></PageShell>; }

function PaymentsContent() {
  const { user } = useSession();
  const [paymentId, setPaymentId] = useState(''); const [recent, setRecent] = useState<string[]>([]); const [payments, setPayments] = useState<Payment[]>([]); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { setRecent(user?.id ? recentPaymentIds(user.id) : []); setPayments([]); }, [user?.id]);
  async function lookup(id: string) { const trimmed = id.trim(); if (!trimmed) return; setBusy(true); setError(null); try { const value = await apiData<Payment>(`payments/${trimmed}`); setPayments((current) => [value, ...current.filter((item) => item.id !== value.id)]); } catch (value) { setError(value instanceof Error ? value.message : 'Payment not found.'); } finally { setBusy(false); } }
  function submit(event: FormEvent) { event.preventDefault(); void lookup(paymentId); }
  return <div className="grid gap-6 lg:grid-cols-[360px_1fr]"><Card className="h-fit p-5"><h2 className="font-semibold text-[var(--tradenest-navy)]">Payment lookup</h2><form onSubmit={submit} className="mt-4 grid gap-3"><Input value={paymentId} onChange={(event) => setPaymentId(event.target.value)} placeholder="Payment UUID" /><Button type="submit" disabled={busy}><Search className="size-4" />{busy ? 'Looking up…' : 'Lookup payment'}</Button></form>{recent.length ? <div className="mt-6"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--tradenest-text-secondary)]">Recent on this device</p><div className="mt-2 grid gap-1">{recent.map((id) => <button key={id} type="button" onClick={() => { setPaymentId(id); void lookup(id); }} className="truncate rounded-lg px-2 py-2 text-left font-mono text-[11px] text-[var(--tradenest-blue)] hover:bg-slate-50">{id}</button>)}</div></div> : null}</Card><div>{error ? <div className="mb-4"><ErrorNotice message={error} /></div> : null}{payments.length ? <div className="grid gap-4">{payments.map((payment) => <PaymentCard key={payment.id} payment={payment} />)}</div> : <EmptyState icon={CreditCard} title="No payment loaded" description="Create a provider payment from checkout or an order, then inspect its backend-controlled status here." />}</div></div>;
}

function PaymentCard({ payment }: { payment: Payment }) { const tone = payment.status === 'SUCCEEDED' ? 'success' : payment.status === 'FAILED' ? 'danger' : 'warning'; return <Card className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><h2 className="font-semibold text-[var(--tradenest-navy)]">{formatMoney(payment.amount, payment.currency)}</h2><Badge tone={tone}>{payment.status}</Badge></div><p className="mt-2 break-all font-mono text-xs text-[var(--tradenest-text-secondary)]">{payment.id}</p><p className="mt-2 text-xs text-[var(--tradenest-text-secondary)]">Provider {payment.provider} · order {payment.orderId}</p></div><div className="text-right text-xs text-[var(--tradenest-text-secondary)]">{payment.paidAt ? `Paid ${new Date(payment.paidAt).toLocaleString()}` : 'Awaiting verified provider result'}</div></div>{payment.failureMessage ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{payment.failureMessage}</p> : null}</Card>; }
