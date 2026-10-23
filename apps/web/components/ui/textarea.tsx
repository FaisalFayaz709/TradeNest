import * as React from 'react';
import { cn } from '@/lib/utils';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn('flex min-h-28 min-w-0 w-full resize-y rounded-[var(--tradenest-radius-control)] border border-[var(--tradenest-border-strong)] bg-white px-3 py-2.5 text-base leading-6 text-[var(--tradenest-text)] placeholder:text-[var(--tradenest-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tradenest-focus)] focus-visible:ring-offset-1 aria-invalid:border-[var(--tradenest-danger)] aria-invalid:ring-2 aria-invalid:ring-[var(--tradenest-danger)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600 disabled:opacity-70 sm:text-sm', className)} {...props} />,
);
Textarea.displayName = 'Textarea';
