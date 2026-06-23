import type { LucideIcon } from 'lucide-react';

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
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[13px] text-neutral-mid font-body">{label}</div>
          <div className="mt-2 text-[32px] font-bold text-neutral-dark font-display leading-tight">
            {value}
          </div>
          {trend && (
            <div
              className={`mt-1 text-xs font-body ${
                trendUp === undefined ? 'text-neutral-mid' : trendUp ? 'text-primary' : 'text-expired'
              }`}
            >
              {trendUp === true && '▲ '}
              {trendUp === false && '▼ '}
              {trend}
            </div>
          )}
          {sub && <div className="mt-1 text-xs text-neutral-mid font-body">{sub}</div>}
        </div>
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light">
            <Icon size={20} className="text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
