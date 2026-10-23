import * as React from 'react';
import { cn } from '@/lib/utils';

// shadcn/ui forwardRef input; accepts all native input types, including file.
export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} ref={ref} className={cn('flex min-h-11 min-w-0 w-full rounded-[var(--tradenest-radius-control)] border border-[var(--tradenest-border-strong)] bg-white px-3 py-2 text-base text-[var(--tradenest-text)] transition-colors file:mr-2 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--tradenest-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tradenest-focus)] focus-visible:ring-offset-1 aria-invalid:border-[var(--tradenest-danger)] aria-invalid:ring-2 aria-invalid:ring-[var(--tradenest-danger)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600 disabled:opacity-70 sm:text-sm', className)} {...props} />
  ),
);
Input.displayName = 'Input';
