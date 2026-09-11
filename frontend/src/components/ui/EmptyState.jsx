import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  className
}) {
  return (
    <div
      className={cn(
        'py-14 px-6 flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 backdrop-blur',
        className
      )}
    >
      {Icon && (
        <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/60 text-slate-400 mb-3 shadow-inner">
          <Icon className="w-7 h-7 stroke-[1.5]" />
        </div>
      )}
      <h4 className="text-sm font-bold text-white tracking-tight">{title}</h4>
      {description && (
        <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {actionText && onAction && (
        <Button
          onClick={onAction}
          variant="secondary"
          size="sm"
          className="mt-4"
        >
          {actionText}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
