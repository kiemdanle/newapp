import * as React from 'react';
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
    <div className="group relative flex h-full flex-col justify-between rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-card hover:border-primary/30 hover:shadow-dropdown transition-all duration-200 motion-reduce:transition-none overflow-hidden">
      <div>
        {/* Top bar: Icon badge and optional Trend indicator */}
        <div className="flex items-center justify-between gap-2">
          {Icon ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-light/40 text-primary-dark border border-primary/15 shadow-xs group-hover:scale-105 group-hover:bg-primary-light/60 transition-transform motion-reduce:transform-none">
              <Icon size={18} className="text-primary-dark" />
            </div>
          ) : (
            <div className="h-9" />
          )}

          {trend && (
            <div
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight ${
                trendUp === undefined
                  ? 'bg-neutral-light text-neutral-mid border border-border/60'
                  : trendUp
                    ? 'bg-primary-light/50 text-primary-dark border border-primary/25'
                    : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}
            >
              {trendUp === true && <TrendingUp className="h-3 w-3" />}
              {trendUp === false && <TrendingDown className="h-3 w-3" />}
              <span>{trend}</span>
            </div>
          )}
        </div>

        {/* Main metric section: full-width label and bold value */}
        <div className="mt-3.5 space-y-1">
          <div
            title={label}
            className="text-xs font-semibold text-neutral-mid font-body leading-snug tracking-normal break-words min-h-[2rem] flex items-end"
          >
            {label}
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-neutral-dark font-display leading-tight tracking-tight tabular-nums">
            {value}
          </div>
        </div>
      </div>

      {/* Bottom helper note / context */}
      {sub && (
        <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] text-neutral-mid font-body leading-tight">
          {sub}
        </div>
      )}
    </div>
  );
}
