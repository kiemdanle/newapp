import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all select-none',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white shadow-xs',
        secondary: 'bg-neutral-light text-neutral-dark border border-neutral-200/80',
        destructive: 'bg-red-50 text-red-700 border border-red-200/80',
        outline: 'border border-neutral-300 text-neutral-dark bg-white',
        good: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80',
        expiring: 'bg-amber-50 text-amber-800 border border-amber-200/80',
        expired: 'bg-red-50 text-red-800 border border-red-200/80',
        neutral: 'bg-neutral-100 text-neutral-700 border border-neutral-200',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
