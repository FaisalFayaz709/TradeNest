import * as React from 'react';
import { cn } from '@/lib/utils';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn('flex min-h-28 w-full resize-y rounded-[var(--tradenest-radius-control)] border border-[var(--tradenest-border)] bg-white px-3 py-2.5 text-sm text-[var(--tradenest-text)] placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tradenest-teal)] disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />,
);
Textarea.displayName = 'Textarea';
