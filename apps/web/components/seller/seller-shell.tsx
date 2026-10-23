'use client';

import { usePathname } from 'next/navigation';
import { BarChart3, Boxes, BrainCircuit, CreditCard, Gauge, Gavel, PackageSearch, Settings, ShieldCheck, Store } from 'lucide-react';
import type { ReactNode } from 'react';
import { SellerGate } from '../seller-gate';
import { WorkspaceNav } from '../workspace-nav';

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

type SellerShellProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function SellerShell({ title, description, action, children }: SellerShellProps) {
  const pathname = usePathname();

  return (
    <SellerGate>
      <main className="mx-auto grid w-full min-w-0 max-w-7xl gap-5 px-3 py-5 sm:px-6 sm:py-8 xl:grid-cols-[220px_minmax(0,1fr)] xl:items-start xl:gap-6 xl:px-8 xl:py-10">
        <WorkspaceNav kind="seller" pathname={pathname} links={links} />
        <section className="min-w-0">
          <div className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between xl:mb-7">
            <div className="min-w-0">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--tradenest-teal-action)]">Seller</p>
              <h1 className="break-words text-2xl font-semibold tracking-tight text-[var(--tradenest-navy)] sm:text-3xl">{title}</h1>
              {description ? <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-[var(--tradenest-text-secondary)]">{description}</p> : null}
            </div>
            {action ? <div className="min-w-0 shrink-0">{action}</div> : null}
          </div>
          {children}
        </section>
      </main>
    </SellerGate>
  );
}
