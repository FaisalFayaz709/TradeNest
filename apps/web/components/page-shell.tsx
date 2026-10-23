import type { ReactNode } from 'react';

export function PageShell({ eyebrow, title, description, children, action }: { eyebrow?: string; title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <main className="mx-auto w-full min-w-0 max-w-7xl px-3 py-6 sm:px-6 sm:py-9 lg:px-8 lg:py-12">
      <div className="mb-7 flex min-w-0 flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          {eyebrow ? <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--tradenest-teal-ink)]">{eyebrow}</p> : null}
          <h1 className="break-words text-[clamp(1.75rem,5vw,2.5rem)] font-semibold leading-tight tracking-tight text-[var(--tradenest-navy)]">{title}</h1>
          {description ? <p className="mt-3 max-w-2xl break-words text-sm leading-6 text-[var(--tradenest-text-secondary)] sm:text-base">{description}</p> : null}
        </div>
        {action ? <div className="flex min-w-0 w-full flex-wrap items-center gap-2 lg:w-auto lg:max-w-[50%] lg:justify-end [&>*]:max-w-full">{action}</div> : null}
      </div>
      {children}
    </main>
  );
}
