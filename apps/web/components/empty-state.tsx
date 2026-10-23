import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from './ui/card';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
};

/** Empty states use the same readable mobile-first layout across all workspaces. */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="flex min-w-0 flex-col items-center px-4 py-10 text-center sm:px-8 sm:py-14">
      <div className="mb-5 flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--tradenest-teal-light)] text-[var(--tradenest-teal-ink)]">
        <Icon aria-hidden="true" className="size-6" />
      </div>
      <h2 className="max-w-full break-words text-lg font-semibold leading-snug tracking-tight text-[var(--tradenest-navy)] sm:text-xl">
        {title}
      </h2>
      <p className="mt-2 max-w-lg break-words text-sm leading-6 text-[var(--tradenest-text-secondary)]">
        {description}
      </p>
      {action ? (
        <div className="mt-6 flex w-full min-w-0 flex-wrap justify-center gap-2 sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
          {action}
        </div>
      ) : null}
    </Card>
  );
}
