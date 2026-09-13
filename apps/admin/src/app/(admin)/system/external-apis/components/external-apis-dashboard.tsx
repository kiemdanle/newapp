'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type {
  BarcodeApiStats,
  BarcodeApiRequestsList,
} from '@expyrico/shared';
import { KpiCard } from '@/components/kpi-card';
import { Button } from '@/components/ui/button';
import { ProviderCard } from './provider-card';
import { VolumeTimelineChart } from './volume-chart';
import { RequestLogTable } from './request-log-table';
import { TopBarcodesCard } from './top-barcodes-card';
import { RequestDetailModal } from './request-detail-modal';
import { BarcodeProbeModal } from './barcode-probe-modal';
import { ProviderSettingsModal } from './provider-settings-modal';
import {
  Activity,
  AlertOctagon,
  Barcode,
  CheckCircle2,
  Clock,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react';

interface ExternalApisDashboardProps {
  stats: BarcodeApiStats;
  requests: BarcodeApiRequestsList;
  range: '24h' | '7d' | '30d';
}

export function ExternalApisDashboard({
  stats,
  requests,
  range,
}: ExternalApisDashboardProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [pollInterval, setPollInterval] = React.useState<number>(0); // 0 = off by default

  // Modals state
  const [inspectLogId, setInspectLogId] = React.useState<string | null>(null);
  const [probeModalOpen, setProbeModalOpen] = React.useState(false);
  const [probeProvider, setProbeProvider] = React.useState('off');
  const [settingsModalOpen, setSettingsModalOpen] = React.useState(false);
  const [settingsProvider, setSettingsProvider] = React.useState('off');

  // Handle manual refresh
  const handleRefresh = React.useCallback(() => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [router]);

  // Optional auto-polling (off by default per validation decision 3)
  React.useEffect(() => {
    if (pollInterval <= 0) return;
    const timer = setInterval(() => {
      router.refresh();
    }, pollInterval * 1000);
    return () => clearInterval(timer);
  }, [pollInterval, router]);

  const handleOpenProbe = (provKey = 'off') => {
    setProbeProvider(provKey);
    setProbeModalOpen(true);
  };

  const handleOpenSettings = (provKey = 'off') => {
    setSettingsProvider(provKey);
    setSettingsModalOpen(true);
  };

  const handleProbeBarcode = (barcode: string) => {
    setProbeProvider('off');
    setProbeModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-[#FAFAF8] shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#3A8F6F] uppercase tracking-wider">
            <Zap size={14} />
            <span>Registry Telemetry & Command Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#2C2C28] font-display tracking-tight mt-1">
            External Barcode APIs
          </h1>
          <p className="text-xs text-[#8C8C85] mt-0.5">
            Operational telemetry, durable quotas, error rates, and diagnostic controls for OpenFoodFacts & UPCitemdb.
          </p>
        </div>

        {/* Live Refresh and Polling Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Range Pills */}
          <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-white p-1 shadow-2xs">
            {(['24h', '7d', '30d'] as const).map((r) => {
              const isSelected = r === range;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => router.push(`/system/external-apis?range=${r}`)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-all min-h-[36px] ${
                    isSelected
                      ? 'bg-[#4BAE8A] text-white shadow-xs'
                      : 'text-[#8C8C85] hover:text-[#2C2C28] hover:bg-[#F0F0ED]'
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>

          {/* Polling Interval Switcher */}
          <div className="flex items-center gap-1.5 text-xs text-[#8C8C85] bg-white border border-border rounded-xl px-2.5 py-1">
            <Clock size={13} />
            <span className="font-medium text-[#2C2C28]">Auto-Refresh:</span>
            <select
              aria-label="Auto-refresh interval"
              value={pollInterval}
              onChange={(e) => setPollInterval(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-[#3A8F6F] outline-none cursor-pointer"
            >
              <option value={0}>Off</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
            </select>
          </div>

          {/* Manual Refresh Button */}
          <Button
            size="sm"
            variant="outline"
            disabled={isRefreshing}
            onClick={handleRefresh}
            className="h-10 min-h-[44px] min-w-[44px] px-3.5 text-xs font-semibold bg-white border-border hover:bg-[#FAFAF8]"
          >
            <RefreshCw
              size={14}
              className={`mr-1.5 text-[#3A8F6F] ${isRefreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>

          {/* Quick Probe Launch Button */}
          <Button
            size="sm"
            onClick={() => handleOpenProbe('off')}
            className="h-10 min-h-[44px] min-w-[44px] px-4 text-xs font-semibold bg-[#4BAE8A] hover:bg-[#3A8F6F] text-white shadow-xs"
          >
            <Barcode size={15} className="mr-1.5" />
            Live Probe
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Lookups (Organic)"
          value={stats.summary.totalCalls.toLocaleString()}
          icon={Activity}
          sub={`Filtered: probe calls isolated (${range})`}
        />

        <KpiCard
          label="Overall Hit Rate"
          value={`${stats.summary.hitRatePercent}%`}
          icon={CheckCircle2}
          trend={`${stats.summary.hitCount} found products`}
          trendUp={stats.summary.hitRatePercent >= 70}
          sub={`${stats.summary.missCount} conclusive misses`}
        />

        <KpiCard
          label="Upstream Error & Rate Limits"
          value={`${stats.summary.errorRatePercent}%`}
          icon={AlertOctagon}
          trend={stats.summary.errorRatePercent > 5 ? 'High Errors' : 'Nominal'}
          trendUp={stats.summary.errorRatePercent <= 5}
          sub={`${stats.summary.rateLimitedCount} 429s • ${stats.summary.timeoutCount} timeouts`}
        />

        <KpiCard
          label="Latency p95 Budget"
          value={`${stats.summary.p95DurationMs}ms`}
          icon={Clock}
          trend={`avg: ${stats.summary.avgDurationMs}ms`}
          trendUp={stats.summary.p95DurationMs <= 2000}
          sub="Excluded non-network skips"
        />
      </div>

      {/* Provider Command Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-[#2C2C28] font-display flex items-center gap-2">
            <Server size={18} className="text-[#3A8F6F]" />
            Provider Command Center
          </h2>
          <span className="text-xs text-[#8C8C85]">
            Individual health, quotas, circuit breakers, and settings
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Object.entries(stats.providers).map(([pKey, pStats]) => (
            <ProviderCard
              key={pKey}
              providerKey={pKey}
              stats={pStats}
              onOpenProbe={handleOpenProbe}
              onOpenSettings={handleOpenSettings}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      </div>

      {/* Volume Chart & Barcode Traffic Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <VolumeTimelineChart timeline={stats.volumeTimeline} range={range} />
        </div>
        <div className="lg:col-span-1">
          <TopBarcodesCard
            topBarcodes={stats.topBarcodes}
            topMisses={stats.topMisses}
            onProbeBarcode={handleProbeBarcode}
          />
        </div>
      </div>

      {/* Granular Request Logs Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-[#2C2C28] font-display flex items-center gap-2">
            <Activity size={18} className="text-[#3A8F6F]" />
            Granular API Request Inspector
          </h2>
          <span className="text-xs text-[#8C8C85]">
            Real-time call logs with lazy-loaded payload diagnostics
          </span>
        </div>

        <RequestLogTable
          initialItems={requests.items}
          initialNextCursor={requests.nextCursor}
          onInspect={(id) => setInspectLogId(id)}
        />
      </div>

      {/* Modals */}
      <RequestDetailModal
        logId={inspectLogId}
        onClose={() => setInspectLogId(null)}
      />

      <BarcodeProbeModal
        isOpen={probeModalOpen}
        initialProvider={probeProvider}
        onClose={() => setProbeModalOpen(false)}
      />

      <ProviderSettingsModal
        isOpen={settingsModalOpen}
        providerKey={settingsProvider}
        stats={stats.providers[settingsProvider]}
        onClose={() => setSettingsModalOpen(false)}
        onSaved={handleRefresh}
      />
    </div>
  );
}
