'use client';

import React from 'react';
import type { GoogleMapsSummary } from '@expyrico/shared';
import {
  Gauge,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Zap,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

export function QuotaGaugeCard({ summary }: { summary: GoogleMapsSummary }) {
  const {
    todayRequests,
    dailyQuotaLimit,
    dailyQuotaPercentage,
    monthlyRequests,
    monthlyFreeTierLimit,
    estimatedCostUsd,
    alertLevel,
    avgDurationMs,
    p95DurationMs,
    cacheHitRatio,
  } = summary;

  const getProgressColor = () => {
    if (alertLevel === 'critical') return 'bg-red-500';
    if (alertLevel === 'warning') return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="space-y-4">
      {/* Dynamic Multi-Stage Alert Banners */}
      {alertLevel === 'critical' && (
        <div className="bg-red-50 border border-red-300 rounded-2xl p-4 flex items-start gap-3 shadow-sm text-red-900 animate-in fade-in">
          <AlertOctagon className="text-red-600 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-bold text-sm">Critical Quota Warning (95%+)</h4>
            <p className="text-xs text-red-700 mt-0.5">
              Today&apos;s Google Maps requests have reached {todayRequests} / {dailyQuotaLimit} ({dailyQuotaPercentage}%).
              The daily safety cap will stop further lookups at 1,000 requests.
            </p>
          </div>
        </div>
      )}

      {alertLevel === 'warning' && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3 shadow-sm text-amber-900 animate-in fade-in">
          <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-bold text-sm">Daily Quota Alert (80%+)</h4>
            <p className="text-xs text-amber-700 mt-0.5">
              Google Maps request volume is elevated ({todayRequests} / {dailyQuotaLimit} requests today).
              Operating within safety buffer.
            </p>
          </div>
        </div>
      )}

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Daily Quota Card */}
        <div className="bg-white border border-neutral-light rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-neutral-mid">
            <span className="text-xs font-semibold uppercase tracking-wider">Today&apos;s Quota</span>
            <Gauge size={16} className="text-primary" />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-neutral-dark">
                {todayRequests}
                <span className="text-xs font-normal text-neutral-mid ml-1">/ {dailyQuotaLimit}</span>
              </span>
              <span className="text-xs font-semibold font-mono text-neutral-dark">
                {dailyQuotaPercentage}%
              </span>
            </div>
            <div className="w-full bg-neutral-light h-2 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`}
                style={{ width: `${Math.min(100, dailyQuotaPercentage)}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-neutral-mid flex items-center gap-1">
            <CheckCircle2 size={12} className="text-emerald-500" />
            Hard-capped at 1,000 requests/day
          </p>
        </div>

        {/* Monthly Free Tier Usage */}
        <div className="bg-white border border-neutral-light rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-neutral-mid">
            <span className="text-xs font-semibold uppercase tracking-wider">Monthly Tier</span>
            <DollarSign size={16} className="text-primary" />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-neutral-dark">
                {monthlyRequests}
                <span className="text-xs font-normal text-neutral-mid ml-1">/ {monthlyFreeTierLimit}</span>
              </span>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                ${estimatedCostUsd.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-neutral-light h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${Math.min(100, (monthlyRequests / monthlyFreeTierLimit) * 100)}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-neutral-mid">
            $200 Google monthly credit active
          </p>
        </div>

        {/* Cache Hit Ratio */}
        <div className="bg-white border border-neutral-light rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-neutral-mid">
            <span className="text-xs font-semibold uppercase tracking-wider">Cache Efficiency</span>
            <Zap size={16} className="text-primary" />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-neutral-dark">
                {cacheHitRatio}%
              </span>
              <span className="text-xs text-neutral-mid">
                {summary.cacheHitCount} hits
              </span>
            </div>
            <div className="w-full bg-neutral-light h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${Math.min(100, cacheHitRatio)}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-neutral-mid">
            ~11m coordinate proximity cache
          </p>
        </div>

        {/* Latency Performance */}
        <div className="bg-white border border-neutral-light rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-neutral-mid">
            <span className="text-xs font-semibold uppercase tracking-wider">Latency</span>
            <Clock size={16} className="text-primary" />
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-neutral-dark">
                {avgDurationMs}
                <span className="text-xs font-normal text-neutral-mid ml-1">ms</span>
              </span>
              <span className="text-xs text-neutral-mid">avg</span>
            </div>
            <p className="text-xs text-neutral-mid font-mono">
              p95: {p95DurationMs} ms
            </p>
          </div>
          <p className="text-[11px] text-neutral-mid">
            4,000 ms circuit-breaker timeout
          </p>
        </div>
      </div>
    </div>
  );
}
