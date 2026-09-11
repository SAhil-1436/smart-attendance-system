import React from 'react';
import { cn } from '../../lib/utils';

export function Card({ className, hover = true, glow = false, children, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md shadow-xl text-slate-100 transition-all duration-300',
        hover && 'hover:border-slate-700/80 hover:bg-slate-900/80',
        glow && 'border-indigo-500/30 shadow-[0_0_25px_rgba(99,102,241,0.12)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }) {
  return (
    <div className={cn('p-5 flex flex-col space-y-1.5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }) {
  return (
    <h3
      className={cn('text-base font-bold text-white tracking-tight leading-none', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }) {
  return (
    <p className={cn('text-xs text-slate-400 leading-relaxed', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }) {
  return (
    <div className={cn('p-5 pt-0', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }) {
  return (
    <div
      className={cn('p-5 pt-0 flex items-center border-t border-slate-800/60 mt-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}
