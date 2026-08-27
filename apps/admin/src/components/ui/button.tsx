import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99] select-none',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white shadow-sm hover:bg-primary-dark shadow-xs',
        accent: 'bg-accent text-accent-foreground shadow-sm hover:bg-accent/90',
        destructive: 'bg-red-50 text-red-700 border border-red-200/80 hover:bg-red-100',
        outline: 'border border-neutral-300 bg-white text-neutral-dark hover:bg-neutral-light hover:border-neutral-400 shadow-xs',
        ghost: 'text-neutral-mid hover:bg-neutral-light/70 hover:text-neutral-dark',
        secondary: 'bg-neutral-light text-neutral-dark hover:bg-neutral-200/70',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs rounded-lg',
        lg: 'h-12 px-6 text-base rounded-xl',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';
