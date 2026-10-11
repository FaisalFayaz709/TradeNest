import type { LucideIcon } from 'lucide-react';
import { Card } from './ui/card';

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-slate-100 text-[var(--tradenest-navy)]"><Icon className="size-5" /></div>
      <h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--tradenest-text-secondary)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}
