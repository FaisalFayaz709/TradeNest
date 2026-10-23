import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn/ui CVA badge with blueprint-aligned TradeNest semantic tones.
export const badgeVariants = cva(
  'inline-flex min-w-0 max-w-full items-center rounded-full border border-transparent px-2.5 py-1 text-left text-xs font-semibold leading-5 break-words transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tradenest-focus)]',
  {
    variants: {
      variant: {
        default: 'bg-[var(--tradenest-navy)] text-white',
        secondary: 'bg-slate-100 text-slate-700',
        destructive: 'bg-red-50 text-[var(--tradenest-danger-ink)]',
        outline: 'border-[var(--tradenest-border)] text-[var(--tradenest-text)]',
      },
      tone: {
        neutral: 'bg-slate-100 text-slate-700',
        success: 'bg-green-50 text-[var(--tradenest-success-ink)]',
        warning: 'bg-amber-50 text-[var(--tradenest-warning-ink)]',
        danger: 'bg-red-50 text-[var(--tradenest-danger-ink)]',
        ai: 'bg-[var(--tradenest-teal-light)] text-[var(--tradenest-teal-ink)]',
        escrow: 'bg-[var(--tradenest-gold-light)] text-[var(--tradenest-gold-ink)]',
      },
    },
    defaultVariants: { variant: 'secondary' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, tone, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant, tone: tone ?? (variant ? null : 'neutral'), className }))} {...props} />
  ),
);
Badge.displayName = 'Badge';
