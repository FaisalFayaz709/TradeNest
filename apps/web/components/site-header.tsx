'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Menu, Search, ShieldCheck, ShoppingBag, Store, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { useSession } from './session-provider';
import { Button } from './ui/button';

const shopLinks = [
  { href: '/explore', label: 'Explore' },
  { href: '/categories', label: 'Categories' },
  { href: '/orders', label: 'Orders', buyerOnly: true },
  { href: '/wishlist', label: 'Wishlist', buyerOnly: true },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useSession();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await logout();
    setOpen(false);
    router.push('/');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--tradenest-border)] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-[var(--tradenest-navy)]">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--tradenest-navy)] text-white"><ShieldCheck className="size-5" /></span>
          <span className="text-lg tracking-tight">TradeNest</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {shopLinks.filter((item) => !item.buyerOnly || user?.role === 'BUYER').map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return <Link key={item.href} href={item.href} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${active ? 'bg-slate-100 text-[var(--tradenest-navy)]' : 'text-[var(--tradenest-text-secondary)] hover:bg-slate-50 hover:text-[var(--tradenest-text)]'}`}>{item.label}</Link>;
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Link href="/search" aria-label="Search" className="flex size-10 items-center justify-center rounded-lg text-[var(--tradenest-text-secondary)] hover:bg-slate-100"><Search className="size-4" /></Link>
          {user ? <Link href="/notifications" aria-label="Notifications" className="flex size-10 items-center justify-center rounded-lg text-[var(--tradenest-text-secondary)] hover:bg-slate-100"><Bell className="size-5" /></Link> : null}
          {user?.role === 'BUYER' ? (
            <>
              <Link href="/cart" aria-label="Cart" className="flex size-10 items-center justify-center rounded-lg text-[var(--tradenest-text-secondary)] hover:bg-slate-100"><ShoppingBag className="size-4" /></Link>
              <Link href="/profile" className="flex items-center gap-2 rounded-lg border border-[var(--tradenest-border)] px-3 py-2 text-sm font-medium text-[var(--tradenest-text)] hover:bg-slate-50"><UserRound className="size-4" /><span className="max-w-28 truncate">{user.name}</span></Link>
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button>
            </>
          ) : user?.role === 'SELLER' ? (
            <>
              <Link href="/seller" className="flex items-center gap-2 rounded-lg border border-[var(--tradenest-border)] px-3 py-2 text-sm font-medium text-[var(--tradenest-text)] hover:bg-slate-50"><Store className="size-4" /><span className="max-w-28 truncate">{user.name}</span></Link>
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button>
            </>
          ) : user?.role === 'ADMIN' ? (
            <>
              <Link href="/admin" className="flex items-center gap-2 rounded-lg border border-[var(--tradenest-border)] px-3 py-2 text-sm font-medium text-[var(--tradenest-text)] hover:bg-slate-50"><ShieldCheck className="size-4 text-[var(--tradenest-gold)]" /><span className="max-w-28 truncate">{user.name}</span></Link>
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button>
            </>
          ) : user ? (
            <span className="rounded-lg border border-[var(--tradenest-border)] px-3 py-2 text-sm text-[var(--tradenest-text-secondary)]">{user.role}</span>
          ) : loading ? (
            <span className="h-9 w-24 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <>
              <Link href="/auth/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
              <Link href="/auth/register"><Button size="sm">Create account</Button></Link>
            </>
          )}
        </div>

        <button type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="tradenest-mobile-navigation" onClick={() => setOpen((value) => !value)} className="ml-auto flex size-10 items-center justify-center rounded-lg text-[var(--tradenest-navy)] hover:bg-slate-100 md:hidden">{open ? <X className="size-5" /> : <Menu className="size-5" />}</button>
      </div>

      {open ? (
        <div id="tradenest-mobile-navigation" className="border-t border-[var(--tradenest-border)] bg-white px-4 py-4 md:hidden">
          <nav className="grid gap-1">
            {user ? <Link href="/notifications" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"><Bell className="size-4"/> Notifications</Link> : null}
            <Link href="/search" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"><Search className="size-4" />Search</Link>
            {shopLinks.filter((item) => !item.buyerOnly || user?.role === 'BUYER').map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium">{item.label}</Link>)}
            {user?.role === 'BUYER' ? <><Link href="/cart" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"><ShoppingBag className="size-4" />Cart</Link><Link href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"><UserRound className="size-4" />Profile</Link><button type="button" onClick={() => void signOut()} className="rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--tradenest-danger)]">Sign out</button></> : null}
            {user?.role === 'SELLER' ? <><Link href="/seller" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"><Store className="size-4" />Seller workspace</Link><button type="button" onClick={() => void signOut()} className="rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--tradenest-danger)]">Sign out</button></> : null}
            {user?.role === 'ADMIN' ? <><Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"><ShieldCheck className="size-4 text-[var(--tradenest-gold)]" />Admin workspace</Link><button type="button" onClick={() => void signOut()} className="rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--tradenest-danger)]">Sign out</button></> : null}
            {!user && !loading ? <><Link href="/auth/login" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium">Sign in</Link><Link href="/auth/register" onClick={() => setOpen(false)} className="rounded-lg bg-[var(--tradenest-navy)] px-3 py-2 text-sm font-semibold text-white">Create account</Link></> : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
