import { ArrowLeftRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from './ui/card';

/**
 * Keep full admin table information available on narrow screens rather than
 * hiding financial columns or moderation actions behind an overflow clip.
 * The labelled scroll region can also be focused and scrolled by keyboard.
 */
export function TableScroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <p aria-hidden="true" className="flex items-center gap-2 border-b border-[var(--tradenest-border)] bg-slate-50 px-4 py-2 text-xs text-[var(--tradenest-text-secondary)] lg:hidden">
        <ArrowLeftRight aria-hidden="true" className="size-4 shrink-0" />
        Swipe or scroll sideways to view all columns.
      </p>
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className="w-full min-w-0 overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--tradenest-focus)]"
      >
        {children}
      </div>
    </Card>
  );
}
