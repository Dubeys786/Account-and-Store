import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgColor?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconBgColor = 'bg-blue-50 text-blue-600',
  trend,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs hover:shadow-sm transition-shadow min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate" title={title}>
            {title}
          </p>
          <h4 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate" title={String(value)}>
            {value}
          </h4>
          {subtitle && (
            <p className="text-[11px] sm:text-xs text-slate-500 pt-0.5 truncate" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>
        <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${iconBgColor}`}>{icon}</div>
      </div>
      {trend && (
        <div className="mt-2.5 pt-2.5 sm:mt-3 sm:pt-3 border-t border-slate-100 flex items-center text-[11px] sm:text-xs text-slate-600 truncate">
          <span
            className={`font-semibold mr-1.5 shrink-0 ${
              trend.isPositive ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {trend.value}
          </span>
          <span className="text-slate-400 truncate">{trend.label || 'vs last month'}</span>
        </div>
      )}
    </div>
  );
};

export default StatsCard;
