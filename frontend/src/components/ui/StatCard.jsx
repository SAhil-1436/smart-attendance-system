import React from 'react';
import { cn } from '../../lib/utils';
import { Card } from './Card';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendPositive = true,
  variant = 'default',
  className
}) {
  const variantStyles = {
    default: 'from-indigo-600/10 to-transparent border-slate-800/80',
    indigo: 'from-indigo-600/20 via-indigo-600/5 to-transparent border-indigo-500/30',
    emerald: 'from-emerald-600/20 via-emerald-600/5 to-transparent border-emerald-500/30',
    amber: 'from-amber-600/20 via-amber-600/5 to-transparent border-amber-500/30',
    purple: 'from-purple-600/20 via-purple-600/5 to-transparent border-purple-500/30',
  };

  const iconColors = {
    default: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };

  return (
    <Card
      className={cn(
        'relative overflow-hidden bg-gradient-to-br p-5 border transition-all duration-300 hover:translate-y-[-2px]',
        variantStyles[variant] || variantStyles.default,
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        {Icon && (
          <div className={cn('p-2.5 rounded-xl border', iconColors[variant] || iconColors.default)}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-extrabold text-white tracking-tight">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              'inline-flex items-center text-[11px] font-semibold px-1.5 py-0.5 rounded-md',
              trendPositive
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-rose-400 bg-rose-500/10'
            )}
          >
            {trendPositive ? (
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
            ) : (
              <ArrowDownRight className="w-3 h-3 mr-0.5" />
            )}
            {trend}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-[11px] text-slate-400 mt-1 font-medium">
          {subtitle}
        </p>
      )}
    </Card>
  );
}

export default StatCard;
