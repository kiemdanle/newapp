'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { GoogleMapsSummary } from '@expyrico/shared';
import { QuotaGaugeCard } from './quota-gauge-card';
import { RequestLogTable } from './request-log-table';
import { CoordinateProbeModal } from './coordinate-probe-modal';
import {
  Compass,
  Barcode,
  Layers,
  Sparkles,
  Calendar,
  BarChart3,
} from 'lucide-react';

export function GoogleMapsDashboard({
  summary,
  timeRange,
  page,
  status,
}: {
  summary: GoogleMapsSummary;
  timeRange: '24h' | '7d' | '30d';
  page: number;
  status: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isProbeOpen, setIsProbeOpen] = useState(false);

  const setRange = (newRange: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('timeRange', newRange);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  };

  const maxVolume = Math.max(1, ...summary.volumeSeries.map((v) => v.total));

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <Layers size={14} />
            <span>Infrastructure & External APIs</span>
          </div>
          <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
            Google Maps Geocoding API
          </h1>
          <p className="text-sm text-neutral-mid mt-0.5">
            Monitor reverse geocoding volume, daily quota consumption, latency metrics, and audit logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsProbeOpen(true)}
            className="inline-flex items-center gap-2 text-xs font-semibold bg-white text-neutral-dark border border-neutral-light px-4 py-2 rounded-xl hover:bg-neutral-light/50 transition shadow-sm"
          >
            <Compass size={14} className="text-primary" />
            <span>Coordinate Probe</span>
          </button>

          {/* Time Range Selector */}
          <div className="flex items-center gap-1 bg-neutral-light/50 p-1 rounded-xl border border-neutral-light text-xs font-semibold">
            {(['24h', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  timeRange === r
                    ? 'bg-white text-neutral-dark shadow-sm'
                    : 'text-neutral-mid hover:text-neutral-dark'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* External API Subnavigation */}
      <div className="border-b border-neutral-light flex gap-6 text-sm font-semibold">
        <Link
          href="/system/external-apis"
          className="pb-3 text-neutral-mid hover:text-neutral-dark border-b-2 border-transparent transition flex items-center gap-2"
        >
          <Barcode size={16} />
          <span>Barcode Providers</span>
        </Link>
        <Link
          href="/system/external-apis/google-maps"
          className="pb-3 text-primary border-b-2 border-primary transition flex items-center gap-2"
        >
          <Compass size={16} />
          <span>Google Maps Platform</span>
        </Link>
      </div>

      {/* Metric Cards & Gauge */}
      <QuotaGaugeCard summary={summary} />

      {/* Daily Volume Bar Chart */}
      <div className="bg-white border border-neutral-light rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-primary" />
            <h3 className="text-sm font-bold text-neutral-dark">Daily Request Volume ({timeRange.toUpperCase()})</h3>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />
              Success (API)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
              Cached
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
              Error
            </span>
          </div>
        </div>

        {summary.volumeSeries.length === 0 ? (
          <p className="text-xs text-neutral-mid py-4 text-center">No volume data in this range.</p>
        ) : (
          <div className="pt-4 pb-2">
            <div className="flex items-end gap-2 h-36">
              {summary.volumeSeries.map((point) => {
                const totalHeight = Math.max(4, Math.round((point.total / maxVolume) * 100));
                const successRatio = point.total > 0 ? (point.success / point.total) * 100 : 100;
                const cachedRatio = point.total > 0 ? (point.cached / point.total) * 100 : 0;

                return (
                  <div key={point.date} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                    <div className="w-full flex flex-col justify-end h-32 rounded-lg bg-neutral-light/30 overflow-hidden">
                      <div
                        className="w-full bg-primary rounded-t transition-all duration-300 group-hover:brightness-95 flex flex-col justify-end"
                        style={{ height: `${totalHeight}%` }}
                      >
                        {point.cached > 0 && (
                          <div
                            className="w-full bg-blue-400"
                            style={{ height: `${cachedRatio}%` }}
                          />
                        )}
                        {point.error > 0 && (
                          <div
                            className="w-full bg-red-400"
                            style={{ height: `${(point.error / point.total) * 100}%` }}
                          />
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-neutral-mid font-mono truncate w-full text-center">
                      {point.date.slice(5)}
                    </span>

                    {/* Hover Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-neutral-dark text-white text-[10px] rounded-lg p-2 shadow-lg z-20 whitespace-nowrap pointer-events-none">
                      <strong className="text-white border-b border-white/20 pb-1 mb-1">{point.date}</strong>
                      <span>Total: {point.total}</span>
                      <span className="text-emerald-300">API Calls: {point.success}</span>
                      <span className="text-blue-300">Cached: {point.cached}</span>
                      {point.error > 0 && <span className="text-red-300">Errors: {point.error}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Paginated Request Log Table */}
      <RequestLogTable
        logs={summary.logs}
        totalLogs={summary.totalLogs}
        page={page}
        totalPages={summary.totalPages}
        status={status}
      />

      {/* Coordinate Probe Modal */}
      <CoordinateProbeModal isOpen={isProbeOpen} onClose={() => setIsProbeOpen(false)} />
    </div>
  );
}
