'use client';

import Link from 'next/link';
import { ChevronDown, ShieldCheck, Store } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type WorkspaceLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type WorkspaceNavProps = {
  kind: 'seller' | 'admin';
  pathname: string;
  links: readonly WorkspaceLink[];
};

const linkClass =
  'flex min-h-11 min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tradenest-focus)] focus-visible:ring-offset-2';

function isCurrent(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

function WorkspaceLinks({
  links,
  pathname,
}: {
  links: readonly WorkspaceLink[];
  pathname: string;
}) {
  return (
    <>
      {links.map(({ href, label, icon: Icon }) => {
        const active = isCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            onClick={(event) => {
              // Also collapse when the user selects the current route again.
              const details = event.currentTarget.closest('details');
              if (details) details.open = false;
            }}
            className={`${linkClass} ${active
              ? 'bg-[var(--tradenest-navy)] text-white'
              : 'text-[var(--tradenest-text-secondary)] hover:bg-slate-50 hover:text-[var(--tradenest-navy)]'}`}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{label}</span>
          </Link>
        );
      })}
    </>
  );
}

export function WorkspaceNav({ kind, pathname, links }: WorkspaceNavProps) {
  const isAdmin = kind === 'admin';
  const name = isAdmin ? 'Admin workspace' : 'Seller workspace';
  const Icon = isAdmin ? ShieldCheck : Store;
  const current = links
    .filter(({ href }) => isCurrent(pathname, href))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <>
      {/* Compact in-flow navigation keeps the actual work visible on phones/tablets. */}
      <details
        key={pathname}
        className="group min-w-0 rounded-[var(--tradenest-radius-card)] border border-[var(--tradenest-border)] bg-white shadow-[0_8px_30px_rgba(11,42,74,0.05)] xl:hidden"
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !event.currentTarget.open) return;
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }}
      >
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--tradenest-radius-card)] px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tradenest-focus)] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-3">
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${isAdmin ? 'bg-[var(--tradenest-gold-light)] text-[var(--tradenest-gold-ink)]' : 'bg-[var(--tradenest-teal-light)] text-[var(--tradenest-teal-action)]'}`}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--tradenest-text-secondary)]">{name}</span>
              <span className="block truncate text-sm font-semibold text-[var(--tradenest-navy)]">{current?.label ?? 'Sections'}</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--tradenest-blue)]">
            Sections
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
          </span>
        </summary>
        <nav
          aria-label={`${name} sections`}
          className="grid max-h-[min(65dvh,27rem)] gap-1 overflow-y-auto overscroll-contain border-t border-[var(--tradenest-border)] px-3 py-3"
        >
          <WorkspaceLinks links={links} pathname={pathname} />
        </nav>
      </details>

      {/* Only wide layouts carry the persistent navigation rail. */}
      <aside className="hidden h-fit min-w-0 rounded-[var(--tradenest-radius-card)] border border-[var(--tradenest-border)] bg-white p-3 shadow-[0_8px_30px_rgba(11,42,74,0.05)] xl:sticky xl:top-24 xl:block">
        <div className="mb-3 flex items-center gap-2 px-3 py-2">
          <Icon className={`size-4 shrink-0 ${isAdmin ? 'text-[var(--tradenest-gold-ink)]' : 'text-[var(--tradenest-teal-action)]'}`} aria-hidden="true" />
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--tradenest-navy)]">{name}</p>
        </div>
        <nav aria-label={`${name} desktop sections`} className="grid gap-1">
          <WorkspaceLinks links={links} pathname={pathname} />
        </nav>
      </aside>
    </>
  );
}
