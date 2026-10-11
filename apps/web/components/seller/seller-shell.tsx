'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Boxes, BrainCircuit, CreditCard, Gauge, Gavel, PackageSearch, Settings, ShieldCheck, Store } from 'lucide-react';
import type { ReactNode } from 'react';
import { SellerGate } from '../seller-gate';

const links = [
  { href: '/seller', label: 'Dashboard', icon: Gauge },
  { href: '/seller/products', label: 'Products', icon: PackageSearch },
  { href: '/seller/inventory', label: 'Inventory', icon: Boxes },
  { href: '/seller/orders', label: 'Orders', icon: Store },
  { href: '/seller/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/seller/ai-insights', label: 'AI Insights', icon: BrainCircuit },
  { href: '/seller/payments', label: 'Payments', icon: CreditCard },
  { href: '/seller/escrow', label: 'Escrow', icon: ShieldCheck },
  { href: '/seller/disputes', label: 'Disputes', icon: Gavel },
  { href: '/seller/settings', label: 'Settings', icon: Settings },
];

export function SellerShell({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  return <SellerGate><main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[220px_1fr] lg:px-8 lg:py-10"><aside className="h-fit rounded-[var(--tradenest-radius-card)] border border-[var(--tradenest-border)] bg-white p-3 shadow-[0_8px_30px_rgba(11,42,74,0.05)]"><div className="mb-3 px-3 py-2"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--tradenest-teal)]">Seller workspace</p></div><nav className="grid gap-1">{links.map(({ href, label, icon: Icon }) => { const active = href === '/seller' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`); return <Link key={href} href={href} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? 'bg-[var(--tradenest-navy)] text-white' : 'text-[var(--tradenest-text-secondary)] hover:bg-slate-50 hover:text-[var(--tradenest-text)]'}`}><Icon className="size-4" />{label}</Link>; })}</nav></aside><section className="min-w-0"><div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--tradenest-teal)]">Seller</p><h1 className="text-3xl font-semibold tracking-tight text-[var(--tradenest-navy)]">{title}</h1>{description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--tradenest-text-secondary)]">{description}</p> : null}</div>{action}</div>{children}</section></main></SellerGate>;
}
