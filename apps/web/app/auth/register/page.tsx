'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/session-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const response = await fetch('/api/session/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || 'Registration failed.');
      await refresh(); router.push('/explore'); router.refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Registration failed.'); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8"><Card className="w-full max-w-md p-6 sm:p-8"><div className="flex size-11 items-center justify-center rounded-xl bg-[var(--tradenest-navy)] text-white"><ShieldCheck className="size-5" /></div><h1 className="mt-5 text-2xl font-semibold text-[var(--tradenest-navy)]">Create a Buyer account</h1><p className="mt-2 text-sm leading-6 text-[var(--tradenest-text-secondary)]">This buyer surface always submits the locked public role <strong>BUYER</strong>. Administrator accounts are never publicly registerable.</p><form onSubmit={submit} className="mt-6 grid gap-4"><label className="grid gap-1.5 text-sm font-medium">Name<Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={200} required /></label><label className="grid gap-1.5 text-sm font-medium">Email<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label className="grid gap-1.5 text-sm font-medium">Password<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label><p className="text-xs leading-5 text-[var(--tradenest-text-secondary)]">Password validation is repeated by the NestJS/Zod boundary; this form is only the UX layer.</p>{error ? <p role="alert" className="text-sm text-[var(--tradenest-danger)]">{error}</p> : null}<Button type="submit" size="lg" disabled={busy}>{busy ? 'Creating account…' : 'Create Buyer account'}</Button></form><p className="mt-6 text-center text-sm text-[var(--tradenest-text-secondary)]">Already registered? <Link href="/auth/login" className="font-semibold text-[var(--tradenest-blue)] hover:underline">Sign in</Link></p></Card></main>;
}
