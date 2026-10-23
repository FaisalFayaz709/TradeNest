'use client';

import Link from 'next/link';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSession } from './session-provider';
import { LoadingState } from './loading-state';
import { Button } from './ui/button';
import { Card } from './ui/card';

export function AdminGate({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  if (loading) return <LoadingState label="Checking admin session…" />;
  if (!user) return <Card className="mx-auto max-w-xl p-8 text-center"><LockKeyhole className="mx-auto size-7 text-[var(--tradenest-navy)]" /><h2 className="mt-4 text-xl font-semibold text-[var(--tradenest-navy)]">Admin sign-in required</h2><p className="mt-2 text-sm leading-6 text-[var(--tradenest-text-secondary)]">Administrator accounts cannot be publicly registered. Sign in with an existing authorized Admin account.</p><div className="mt-5"><Button asChild><Link href="/auth/login?returnTo=/admin">Sign in</Link></Button></div></Card>;
  if (user.role !== 'ADMIN') return <Card className="mx-auto max-w-xl p-8 text-center"><ShieldCheck className="mx-auto size-7 text-[var(--tradenest-gold)]" /><h2 className="mt-4 text-xl font-semibold text-[var(--tradenest-navy)]">Admin access required</h2><p className="mt-2 text-sm text-[var(--tradenest-text-secondary)]">You are signed in as {user.role}. NestJS still enforces ADMIN role checks on every administrative endpoint.</p></Card>;
  return <>{children}</>;
}
