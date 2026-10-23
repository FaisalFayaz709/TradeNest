'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { FormEvent, useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/components/session-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// Keep the server-rendered login button disabled until React can intercept the
// submit event. Otherwise an early native form submit may expose a password in
// a GET query string or navigate away before the session request completes.
const subscribeToHydration = () => () => {};
const hydratedSnapshot = () => true;
const serverSnapshot = () => false;

export default function LoginPage() {
  const hydrated = useSyncExternalStore(subscribeToHydration, hydratedSnapshot, serverSnapshot);
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const response = await fetch('/api/session/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const payload = (await response.json()) as { data?: { user?: { role?: string } }; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || 'Sign in failed.');
      await refresh();
      const returnTo = params.get('returnTo');
      router.push(returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : payload.data?.user?.role === 'BUYER' ? '/explore' : payload.data?.user?.role === 'SELLER' ? '/seller' : payload.data?.user?.role === 'ADMIN' ? '/admin' : '/');
      router.refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Sign in failed.'); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8"><Card className="w-full max-w-md p-6 sm:p-8"><div className="flex size-11 items-center justify-center rounded-xl bg-[var(--tradenest-navy)] text-white"><ShieldCheck className="size-5" /></div><h1 className="mt-5 text-2xl font-semibold text-[var(--tradenest-navy)]">Sign in to TradeNest</h1><p className="mt-2 text-sm leading-6 text-[var(--tradenest-text-secondary)]">Your tokens stay in secure HttpOnly web-session cookies; browser components do not receive them.</p><form method="post" onSubmit={submit} className="mt-6 grid gap-4"><label className="grid gap-1.5 text-sm font-medium">Email<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label className="grid gap-1.5 text-sm font-medium">Password<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error ? <p role="alert" className="text-sm text-[var(--tradenest-danger)]">{error}</p> : null}<Button type="submit" size="lg" disabled={busy || !hydrated}>{busy ? 'Signing in…' : 'Sign in'}</Button></form><p className="mt-6 text-center text-sm text-[var(--tradenest-text-secondary)]">New here? <Link href="/auth/register" className="font-semibold text-[var(--tradenest-blue)] hover:underline">Buyer account</Link> · <Link href="/auth/register/seller" className="font-semibold text-[var(--tradenest-teal)] hover:underline">Seller account</Link></p></Card></main>;
}
