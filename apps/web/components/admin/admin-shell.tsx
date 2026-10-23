'use client';

import { usePathname } from 'next/navigation';
import { AlertTriangle, Boxes, CreditCard, FileBarChart, Gauge, Gavel, PackageSearch, Settings, Store, Users, WalletCards } from 'lucide-react';
import type { ReactNode } from 'react';
import { AdminGate } from '../admin-gate';
import { WorkspaceNav } from '../workspace-nav';

const links = [
  { href: '/admin', label: 'Overview', icon: Gauge },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/sellers', label: 'Sellers', icon: Store },
  { href: '/admin/products', label: 'Products', icon: PackageSearch },
  { href: '/admin/orders', label: 'Orders', icon: Boxes },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/escrow', label: 'Escrow', icon: WalletCards },
  { href: '/admin/disputes', label: 'Disputes', icon: Gavel },
  { href: '/admin/fraud-alerts', label: 'Fraud Alerts', icon: AlertTriangle },
  { href: '/admin/reports', label: 'Reports', icon: FileBarChart },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

type AdminShellProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function AdminShell({ title, description, action, children }: AdminShellProps) {
  const pathname = usePathname();

  return (
    <AdminGate>
      <main className="mx-auto grid w-full min-w-0 max-w-7xl gap-5 px-3 py-5 sm:px-6 sm:py-8 xl:grid-cols-[230px_minmax(0,1fr)] xl:items-start xl:gap-6 xl:px-8 xl:py-10">
        <WorkspaceNav kind="admin" pathname={pathname} links={links} />
        <section className="min-w-0">
          <div className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between xl:mb-7">
            <div className="min-w-0">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--tradenest-gold-ink)]">Administration</p>
              <h1 className="break-words text-2xl font-semibold tracking-tight text-[var(--tradenest-navy)] sm:text-3xl">{title}</h1>
              {description ? <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-[var(--tradenest-text-secondary)]">{description}</p> : null}
            </div>
            {action ? <div className="min-w-0 shrink-0">{action}</div> : null}
          </div>
          {children}
        </section>
      </main>
    </AdminGate>
  );
}
