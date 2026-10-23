'use client';

import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSession } from './session-provider';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { LoadingState } from './loading-state';

export function BuyerGate({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  if (loading) return <LoadingState label="Checking your session…" />;
  if (!user) return <Card className="mx-auto max-w-xl p-8 text-center"><LockKeyhole className="mx-auto size-7 text-[var(--tradenest-navy)]" /><h2 className="mt-4 text-xl font-semibold text-[var(--tradenest-navy)]">Sign in to continue</h2><p className="mt-2 text-sm leading-6 text-[var(--tradenest-text-secondary)]">This page uses your authenticated TradeNest buyer session.</p><div className="mt-5 flex justify-center gap-2"><Button asChild><Link href="/auth/login">Sign in</Link></Button><Button variant="outline" asChild><Link href="/auth/register">Create account</Link></Button></div></Card>;
  if (user.role !== 'BUYER') return <Card className="mx-auto max-w-xl p-8 text-center"><h2 className="text-xl font-semibold text-[var(--tradenest-navy)]">Buyer access required</h2><p className="mt-2 text-sm text-[var(--tradenest-text-secondary)]">You are signed in as {user.role}. Buyer-only actions remain isolated from Seller and Admin workspaces, and NestJS enforces the role boundary.</p></Card>;
  return <>{children}</>;
}
