import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none border',
  {
    variants: {
      variant: {
        default:
          'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',
        secondary:
          'bg-slate-800 text-slate-300 border-slate-700',
        success:
          'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
        warning:
          'bg-amber-500/10 text-amber-400 border-amber-500/25',
        destructive:
          'bg-rose-500/10 text-rose-400 border-rose-500/25',
        outline:
          'text-slate-400 border-slate-800 bg-transparent',
        glow:
          'bg-indigo-500/20 text-indigo-300 border-indigo-400/40 shadow-[0_0_12px_rgba(99,102,241,0.25)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export function Badge({ className, variant, children, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </div>
  );
}

export default Badge;
