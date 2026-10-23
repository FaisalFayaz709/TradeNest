'use client';

import Link from 'next/link';
import { LockKeyhole, Store } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSession } from './session-provider';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { LoadingState } from './loading-state';

export function SellerGate({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  if (loading) return <LoadingState label="Checking seller session…" />;
  if (!user) return <Card className="mx-auto max-w-xl p-8 text-center"><LockKeyhole className="mx-auto size-7 text-[var(--tradenest-navy)]" /><h2 className="mt-4 text-xl font-semibold text-[var(--tradenest-navy)]">Seller sign-in required</h2><p className="mt-2 text-sm leading-6 text-[var(--tradenest-text-secondary)]">Use a TradeNest seller account to access this workspace.</p><div className="mt-5 flex justify-center gap-2"><Button asChild><Link href="/auth/login?returnTo=/seller">Sign in</Link></Button><Button variant="outline" asChild><Link href="/auth/register/seller">Create seller account</Link></Button></div></Card>;
  if (user.role !== 'SELLER') return <Card className="mx-auto max-w-xl p-8 text-center"><Store className="mx-auto size-7 text-[var(--tradenest-teal)]" /><h2 className="mt-4 text-xl font-semibold text-[var(--tradenest-navy)]">Seller access required</h2><p className="mt-2 text-sm text-[var(--tradenest-text-secondary)]">You are signed in as {user.role}. Seller business actions remain role and ownership protected by NestJS.</p></Card>;
  return <>{children}</>;
}
