import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** shadcn/ui New York-style button, extended only with TradeNest brand variants. */
export const buttonVariants = cva(
  'inline-flex min-h-11 min-w-0 max-w-full items-center justify-center gap-2 whitespace-normal break-words rounded-[var(--tradenest-radius-control)] px-4 py-2 text-center text-sm font-semibold leading-snug transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--tradenest-focus)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-[var(--tradenest-navy)] text-white hover:bg-[var(--tradenest-blue)]',
        primary: 'bg-[var(--tradenest-navy)] text-white hover:bg-[var(--tradenest-blue)]',
        secondary: 'bg-[var(--tradenest-gold-light)] text-[var(--tradenest-navy)] hover:bg-amber-100',
        outline: 'border border-[var(--tradenest-border-strong)] bg-white text-[var(--tradenest-text)] hover:bg-slate-50',
        ghost: 'text-[var(--tradenest-text-secondary)] hover:bg-slate-100 hover:text-[var(--tradenest-text)]',
        destructive: 'bg-[var(--tradenest-danger)] text-white hover:opacity-90',
        danger: 'bg-[var(--tradenest-danger)] text-white hover:opacity-90',
        ai: 'bg-[var(--tradenest-teal-action)] text-white hover:bg-[var(--tradenest-teal-hover)]',
        link: 'text-[var(--tradenest-blue)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-11 px-4 py-2',
        md: 'min-h-11 px-4 py-2',
        sm: 'min-h-11 px-3 py-2',
        lg: 'min-h-12 px-5 py-3 text-base',
        icon: 'size-11 shrink-0 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
  },
);
Button.displayName = 'Button';
