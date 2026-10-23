'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Menu, Search, ShieldCheck, ShoppingBag, Store, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSession } from './session-provider';
import { Button } from './ui/button';

const shopLinks = [
  { href: '/explore', label: 'Explore' },
  { href: '/categories', label: 'Categories' },
  { href: '/orders', label: 'Orders', buyerOnly: true },
  { href: '/wishlist', label: 'Wishlist', buyerOnly: true },
];

function isCurrentRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const focusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tradenest-focus)] focus-visible:ring-offset-2';
const mobileLinkClass = `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${focusClass}`;

export function SiteHeader() {
  const pathname = usePathname();
  // A route change resets the open drawer, including browser back/forward navigation.
  return <SiteHeaderContent key={pathname} pathname={pathname} />;
}

function SiteHeaderContent({ pathname }: { pathname: string }) {
  const router = useRouter();
  const { user, loading, logout } = useSession();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const links = shopLinks.filter((item) => !item.buyerOnly || user?.role === 'BUYER');

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      menuButtonRef.current?.focus();
    }

    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  async function signOut() {
    await logout();
    setOpen(false);
    router.push('/');
    router.refresh();
  }

  function mobileLink(href: string, label: string, icon?: ReactNode) {
    const active = isCurrentRoute(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={`${mobileLinkClass} ${active ? 'bg-[var(--tradenest-teal-light)] text-[var(--tradenest-navy)]' : 'text-[var(--tradenest-text)] hover:bg-slate-100'}`}
      >
        {icon}
        {label}
      </Link>
    );
  }

  return (
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-[var(--tradenest-border)] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full min-w-0 max-w-7xl items-center gap-1 px-3 sm:gap-2 sm:px-6 xl:gap-4 xl:px-8">
        <Link href="/" aria-label="TradeNest home" className={`flex shrink-0 items-center gap-2 rounded-lg font-semibold text-[var(--tradenest-navy)] ${focusClass}`}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--tradenest-navy)] text-white"><ShieldCheck className="size-5" aria-hidden="true" /></span>
          <span className="text-base tracking-tight sm:text-lg">TradeNest</span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 xl:flex">
          {links.map((item) => {
            const active = isCurrentRoute(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${focusClass} ${active ? 'bg-slate-100 text-[var(--tradenest-navy)]' : 'text-[var(--tradenest-text-secondary)] hover:bg-slate-50 hover:text-[var(--tradenest-text)]'}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden min-w-0 items-center gap-1.5 xl:flex">
          <Link href="/search" aria-label="Search" className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--tradenest-text-secondary)] hover:bg-slate-100 ${focusClass}`}><Search className="size-5" aria-hidden="true" /></Link>
          {user ? <Link href="/notifications" aria-label="Notifications" className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--tradenest-text-secondary)] hover:bg-slate-100 ${focusClass}`}><Bell className="size-5" aria-hidden="true" /></Link> : null}
          {user?.role === 'BUYER' ? (
            <>
              <Link href="/cart" aria-label="Cart" className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--tradenest-text-secondary)] hover:bg-slate-100 ${focusClass}`}><ShoppingBag className="size-5" aria-hidden="true" /></Link>
              <Link href="/profile" className={`flex min-w-0 items-center gap-2 rounded-lg border border-[var(--tradenest-border)] px-3 py-2 text-sm font-medium text-[var(--tradenest-text)] hover:bg-slate-50 ${focusClass}`}><UserRound className="size-4 shrink-0" aria-hidden="true" /><span className="max-w-24 truncate">{user.name}</span></Link>
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button>
            </>
          ) : user?.role === 'SELLER' ? (
            <>
              <Link href="/seller" className={`flex min-w-0 items-center gap-2 rounded-lg border border-[var(--tradenest-border)] px-3 py-2 text-sm font-medium text-[var(--tradenest-text)] hover:bg-slate-50 ${focusClass}`}><Store className="size-4 shrink-0" aria-hidden="true" /><span className="max-w-24 truncate">{user.name}</span></Link>
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button>
            </>
          ) : user?.role === 'ADMIN' ? (
            <>
              <Link href="/admin" className={`flex min-w-0 items-center gap-2 rounded-lg border border-[var(--tradenest-border)] px-3 py-2 text-sm font-medium text-[var(--tradenest-text)] hover:bg-slate-50 ${focusClass}`}><ShieldCheck className="size-4 shrink-0 text-[var(--tradenest-gold-ink)]" aria-hidden="true" /><span className="max-w-24 truncate">{user.name}</span></Link>
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button>
            </>
          ) : user ? (
            <span className="rounded-lg border border-[var(--tradenest-border)] px-3 py-2 text-sm text-[var(--tradenest-text-secondary)]">{user.role}</span>
          ) : loading ? (
            <span className="h-9 w-24 animate-pulse rounded-lg bg-slate-100" aria-hidden="true" />
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild><Link href="/auth/login">Sign in</Link></Button>
              <Button size="sm" asChild><Link href="/auth/register">Create account</Link></Button>
            </>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 xl:hidden">
          <Link href="/search" aria-label="Search" className={`flex size-10 items-center justify-center rounded-lg text-[var(--tradenest-navy)] hover:bg-slate-100 ${focusClass}`}><Search className="size-5" aria-hidden="true" /></Link>
          {user?.role === 'BUYER' ? <Link href="/cart" aria-label="Cart" className={`flex size-10 items-center justify-center rounded-lg text-[var(--tradenest-navy)] hover:bg-slate-100 ${focusClass}`}><ShoppingBag className="size-5" aria-hidden="true" /></Link> : null}
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            aria-controls="tradenest-mobile-navigation"
            onClick={() => setOpen((value) => !value)}
            className={`flex size-11 items-center justify-center rounded-lg text-[var(--tradenest-navy)] hover:bg-slate-100 ${focusClass}`}
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open ? (
        <div id="tradenest-mobile-navigation" className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-[var(--tradenest-border)] bg-white px-3 py-4 shadow-sm sm:px-6 xl:hidden">
          <nav aria-label="Mobile navigation" className="mx-auto grid max-w-7xl gap-1">
            <p className="px-3 pt-1 pb-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--tradenest-text-secondary)]">Browse</p>
            {mobileLink('/search', 'Search', <Search className="size-4" aria-hidden="true" />)}
            {links.map((item) => mobileLink(item.href, item.label))}
            <div className="my-2 h-px bg-[var(--tradenest-border)]" aria-hidden="true" />
            <p className="px-3 pt-1 pb-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--tradenest-text-secondary)]">Account</p>
            {user ? mobileLink('/notifications', 'Notifications', <Bell className="size-4" aria-hidden="true" />) : null}
            {user?.role === 'BUYER' ? <>{mobileLink('/cart', 'Cart', <ShoppingBag className="size-4" aria-hidden="true" />)}{mobileLink('/profile', 'Profile', <UserRound className="size-4" aria-hidden="true" />)}</> : null}
            {user?.role === 'SELLER' ? mobileLink('/seller', 'Seller workspace', <Store className="size-4" aria-hidden="true" />) : null}
            {user?.role === 'ADMIN' ? mobileLink('/admin', 'Admin workspace', <ShieldCheck className="size-4" aria-hidden="true" />) : null}
            {user ? (
              <button type="button" onClick={() => void signOut()} className={`${mobileLinkClass} text-left text-[var(--tradenest-danger-ink)] hover:bg-red-50`}>Sign out</button>
            ) : !loading ? (
              <>
                {mobileLink('/auth/login', 'Sign in', <UserRound className="size-4" aria-hidden="true" />)}
                <Link href="/auth/register" onClick={() => setOpen(false)} className={`${mobileLinkClass} mt-1 justify-center bg-[var(--tradenest-navy)] text-white hover:bg-[var(--tradenest-blue)]`}>Create account</Link>
              </>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
