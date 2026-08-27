import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  trendUp,
  sub,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  sub?: string | undefined;
}) {
  return (
    <div className="group relative rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-card hover:shadow-dropdown transition-all duration-200 overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-mid font-body truncate">
            {label}
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-neutral-dark font-display leading-tight tracking-tight">
            {value}
          </div>
          {trend && (
            <div
              className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                trendUp === undefined
                  ? 'bg-neutral-light text-neutral-mid'
                  : trendUp
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    : 'bg-red-50 text-red-700 border border-red-200/60'
              }`}
            >
              {trendUp === true && <TrendingUp className="h-3 w-3" />}
              {trendUp === false && <TrendingDown className="h-3 w-3" />}
              <span>{trend}</span>
            </div>
          )}
          {sub && <div className="mt-1 text-xs text-neutral-mid font-body">{sub}</div>}
        </div>
        {Icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light/50 text-primary-dark shadow-xs group-hover:scale-105 transition-transform">
            <Icon size={20} className="text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
