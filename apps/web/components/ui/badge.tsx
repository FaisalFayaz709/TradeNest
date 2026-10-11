import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn/ui CVA badge with blueprint-aligned TradeNest semantic tones.
export const badgeVariants = cva(
  'inline-flex items-center rounded-full border border-transparent px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--tradenest-teal)]',
  {
    variants: {
      variant: {
        default: 'bg-[var(--tradenest-navy)] text-white',
        secondary: 'bg-slate-100 text-slate-700',
        destructive: 'bg-red-50 text-[var(--tradenest-danger)]',
        outline: 'border-[var(--tradenest-border)] text-[var(--tradenest-text)]',
      },
      tone: {
        neutral: 'bg-slate-100 text-slate-700',
        success: 'bg-green-50 text-[var(--tradenest-success)]',
        warning: 'bg-amber-50 text-amber-700',
        danger: 'bg-red-50 text-[var(--tradenest-danger)]',
        ai: 'bg-[var(--tradenest-teal-light)] text-teal-800',
        escrow: 'bg-[var(--tradenest-gold-light)] text-amber-800',
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
