import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-xs font-semibold ring-offset-slate-950 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-500 hover:shadow-indigo-600/35 border border-indigo-500/30',
        primary:
          'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30 hover:from-indigo-500 hover:to-indigo-600 border border-indigo-400/30',
        secondary:
          'bg-slate-800/80 text-slate-200 border border-slate-700/80 hover:bg-slate-700 hover:text-white',
        outline:
          'border border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800/80 hover:text-white',
        ghost:
          'text-slate-400 hover:bg-slate-800/60 hover:text-white',
        destructive:
          'bg-red-600/90 text-white hover:bg-red-500 shadow-md shadow-red-600/20 border border-red-500/30',
        success:
          'bg-emerald-600/90 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20 border border-emerald-500/30',
        glow:
          'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:brightness-110',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-[11px]',
        lg: 'h-11 rounded-2xl px-6 text-sm',
        icon: 'h-9 w-9 p-0',
        iconSm: 'h-7 w-7 p-0 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export const Button = React.forwardRef(
  ({ className, variant, size, loading = false, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1 text-current" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export default Button;
