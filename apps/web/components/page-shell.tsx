import type { ReactNode } from 'react';

export function PageShell({ eyebrow, title, description, children, action }: { eyebrow?: string; title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--tradenest-teal)]">{eyebrow}</p> : null}
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--tradenest-navy)] sm:text-4xl">{title}</h1>
          {description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--tradenest-text-secondary)] sm:text-base">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </main>
  );
}
