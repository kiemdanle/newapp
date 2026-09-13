'use client';

import * as React from 'react';
import type { BarcodeProviderStats } from '@expyrico/shared';
import { Button } from '@/components/ui/button';
import { resetBarcodeApiProviderAction } from '@/lib/actions';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  Power,
  RefreshCw,
  Sliders,
  Zap,
  ZapOff,
} from 'lucide-react';

interface ProviderCardProps {
  providerKey: string;
  stats: BarcodeProviderStats;
  onOpenProbe: (providerKey: string) => void;
  onOpenSettings: (providerKey: string) => void;
  onRefresh: () => void;
}

export function ProviderCard({
  providerKey,
  stats,
  onOpenProbe,
  onOpenSettings,
  onRefresh,
}: ProviderCardProps) {
  const [isResettingBreaker, setIsResettingBreaker] = React.useState(false);
  const [isResettingCooldown, setIsResettingCooldown] = React.useState(false);

  const handleReset = async (target: 'breaker' | 'cooldown') => {
    if (target === 'breaker') setIsResettingBreaker(true);
    else setIsResettingCooldown(true);

    try {
      await resetBarcodeApiProviderAction({
        provider: providerKey,
        target,
      });
      onRefresh();
    } finally {
      if (target === 'breaker') setIsResettingBreaker(false);
      else setIsResettingCooldown(false);
    }
  };

  const getStatusBadge = () => {
    switch (stats.state) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-[#D6F0E6] text-[#3A8F6F] border border-[#4BAE8A]/30">
            <CheckCircle2 size={13} className="text-[#4BAE8A]" />
            Healthy
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-[#FEEFC3] text-[#F5A623] border border-[#F5A623]/30">
            <AlertTriangle size={13} className="text-[#F5A623]" />
            Degraded
          </span>
        );
      case 'open':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-red-50 text-[#E0442A] border border-[#E0442A]/30">
            <ZapOff size={13} className="text-[#E0442A]" />
            Circuit Open
          </span>
        );
      case 'exhausted':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-[#FEEFC3] text-[#F5A623] border border-[#F5A623]/30">
            <Flame size={13} className="text-[#F5A623]" />
            Quota Cap
          </span>
        );
      case 'disabled':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-[#F0F0ED] text-[#8C8C85] border border-[#8C8C85]/30">
            <Power size={13} className="text-[#8C8C85]" />
            Disabled
          </span>
        );
    }
  };

  const quotaPercent = stats.quotaPercentage ?? 0;
  const isQuotaWarning = quotaPercent >= 80 && quotaPercent < 100;
  const isQuotaExceeded = quotaPercent >= 100;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border bg-[#FAFAF8] p-5 shadow-xs hover:shadow-card transition-all duration-200">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/70">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-[#2C2C28] font-display">
                {stats.name}
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#F0F0ED] text-[#8C8C85]">
                {providerKey}
              </span>
            </div>
            <p className="text-xs text-[#8C8C85] mt-0.5">
              Timeout: {stats.timeoutMs}ms • Priority: {stats.priority}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
          </div>
        </div>

        {/* Cooldown banner if active */}
        {stats.cooldownActive && (
          <div className="mt-3.5 p-2.5 rounded-xl bg-[#FEEFC3]/80 border border-[#F5A623]/40 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-[#2C2C28]">
              <Clock size={14} className="text-[#F5A623] shrink-0" />
              <span>
                Cooldown Active (429 rate-limited)
                {stats.cooldownRemainingSeconds
                  ? ` • ${stats.cooldownRemainingSeconds}s remaining`
                  : ''}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={isResettingCooldown}
              onClick={() => void handleReset('cooldown')}
              className="h-7 text-[11px] px-2.5 bg-white text-[#F5A623] border-[#F5A623]/40 hover:bg-[#FEEFC3]"
            >
              {isResettingCooldown ? 'Resetting...' : 'Reset'}
            </Button>
          </div>
        )}

        {/* Quota bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-[#2C2C28] flex items-center gap-1.5">
              <Activity size={13} className="text-[#3A8F6F]" />
              Daily Quota Utilization
            </span>
            <span className="font-mono text-[11px] font-medium text-[#2C2C28]">
              {stats.dailyLimit !== null ? (
                <>
                  <strong className="font-bold">{stats.todayCallCount}</strong> /{' '}
                  {stats.dailyLimit}{' '}
                  <span
                    className={
                      isQuotaExceeded
                        ? 'text-[#E0442A] font-bold'
                        : isQuotaWarning
                          ? 'text-[#F5A623] font-bold'
                          : 'text-[#3A8F6F]'
                    }
                  >
                    ({quotaPercent}%)
                  </span>
                </>
              ) : (
                <span className="text-[#8C8C85]">Unlimited (No Daily Cap)</span>
              )}
            </span>
          </div>

          {stats.dailyLimit !== null && (
            <div className="w-full bg-[#F0F0ED] h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isQuotaExceeded
                    ? 'bg-[#E0442A]'
                    : isQuotaWarning
                      ? 'bg-[#F5A623]'
                      : 'bg-[#4BAE8A]'
                }`}
                style={{ width: `${Math.min(100, quotaPercent)}%` }}
              />
            </div>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3.5 border-t border-border/60">
          <div className="p-2.5 rounded-xl bg-white border border-border/70 shadow-2xs">
            <span className="text-[10px] font-semibold text-[#8C8C85] uppercase tracking-wider block">
              Hit Rate
            </span>
            <span className="text-base font-bold text-[#3A8F6F] font-display tabular-nums mt-0.5 block">
              {stats.hitRatePercent}%
            </span>
            <span className="text-[10px] text-[#8C8C85]">
              {stats.hitCount} hits
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-border/70 shadow-2xs">
            <span className="text-[10px] font-semibold text-[#8C8C85] uppercase tracking-wider block">
              Error Rate
            </span>
            <span
              className={`text-base font-bold font-display tabular-nums mt-0.5 block ${
                stats.errorRatePercent > 5 ? 'text-[#E0442A]' : 'text-[#2C2C28]'
              }`}
            >
              {stats.errorRatePercent}%
            </span>
            <span className="text-[10px] text-[#8C8C85]">
              {stats.errorCount + stats.timeoutCount} err/to
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-border/70 shadow-2xs">
            <span className="text-[10px] font-semibold text-[#8C8C85] uppercase tracking-wider block">
              Avg Latency
            </span>
            <span className="text-base font-bold text-[#2C2C28] font-display tabular-nums mt-0.5 block">
              {stats.avgDurationMs}ms
            </span>
            <span className="text-[10px] text-[#8C8C85]">
              p50: {stats.p50DurationMs}ms
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-border/70 shadow-2xs">
            <span className="text-[10px] font-semibold text-[#8C8C85] uppercase tracking-wider block">
              p95 Latency
            </span>
            <span
              className={`text-base font-bold font-display tabular-nums mt-0.5 block ${
                stats.p95DurationMs > 2000 ? 'text-[#F5A623]' : 'text-[#2C2C28]'
              }`}
            >
              {stats.p95DurationMs}ms
            </span>
            <span className="text-[10px] text-[#8C8C85]">
              p99: {stats.p99DurationMs}ms
            </span>
          </div>
        </div>

        {/* Breaker State Indicator */}
        <div className="flex items-center justify-between mt-3 px-3 py-2 rounded-xl bg-white border border-border/60 text-xs">
          <div className="flex items-center gap-2 text-[#8C8C85]">
            <Zap size={14} className="text-[#3A8F6F]" />
            <span>Circuit Breaker:</span>
            <span
              className={`font-semibold capitalize ${
                stats.breakerState === 'closed'
                  ? 'text-[#3A8F6F]'
                  : stats.breakerState === 'halfOpen'
                    ? 'text-[#F5A623]'
                    : 'text-[#E0442A]'
              }`}
            >
              {stats.breakerState}
            </span>
          </div>
          {stats.breakerState !== 'closed' && (
            <Button
              size="sm"
              variant="outline"
              disabled={isResettingBreaker}
              onClick={() => void handleReset('breaker')}
              className="h-7 text-[11px] px-2.5 border-[#E0442A]/40 text-[#E0442A] hover:bg-red-50"
            >
              {isResettingBreaker ? 'Resetting...' : 'Close Breaker'}
            </Button>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-border/60">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onOpenSettings(providerKey)}
          className="h-9 min-h-[44px] min-w-[44px] px-3.5 text-xs text-[#2C2C28] border-border hover:bg-white"
        >
          <Sliders size={14} className="mr-1.5 text-[#8C8C85]" />
          Configure
        </Button>
        <Button
          size="sm"
          onClick={() => onOpenProbe(providerKey)}
          className="h-9 min-h-[44px] min-w-[44px] px-3.5 text-xs bg-[#4BAE8A] hover:bg-[#3A8F6F] text-white shadow-xs"
        >
          <RefreshCw size={14} className="mr-1.5" />
          Test Probe
        </Button>
      </div>
    </div>
  );
}
