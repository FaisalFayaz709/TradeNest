import * as React from 'react';
import { cn } from '@/lib/utils';

// shadcn/ui forwardRef input; accepts all native input types, including file.
export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} ref={ref} className={cn('flex h-11 w-full rounded-[var(--tradenest-radius-control)] border border-[var(--tradenest-border)] bg-white px-3 py-2 text-sm text-[var(--tradenest-text)] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tradenest-teal)] disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />
  ),
);
Input.displayName = 'Input';
