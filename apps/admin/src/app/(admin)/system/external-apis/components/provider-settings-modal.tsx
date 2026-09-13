'use client';

import * as React from 'react';
import type { BarcodeProviderStats } from '@expyrico/shared';
import { updateBarcodeApiConfigAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Flame,
  Loader2,
  Sliders,
  X,
} from 'lucide-react';
interface ProviderSettingsModalProps {
  isOpen: boolean;
  providerKey: string;
  stats?: BarcodeProviderStats | undefined;
  currentRetentionDays?: number | null | undefined;
  onClose: () => void;
  onSaved: () => void;
}

export function ProviderSettingsModal({
  isOpen,
  providerKey,
  stats,
  currentRetentionDays = 30,
  onClose,
  onSaved,
}: ProviderSettingsModalProps) {
  const [enabled, setEnabled] = React.useState(stats?.enabled ?? true);
  const [timeoutMs, setTimeoutMs] = React.useState(stats?.timeoutMs ?? 3000);
  const [dailyLimit, setDailyLimit] = React.useState<string>(
    stats?.dailyLimit !== null && stats?.dailyLimit !== undefined
      ? String(stats.dailyLimit)
      : '',
  );
  const [priority, setPriority] = React.useState(stats?.priority ?? 10);
  const [unlimitedRetention, setUnlimitedRetention] = React.useState(
    currentRetentionDays === null,
  );
  const [retentionDays, setRetentionDays] = React.useState<number>(
    currentRetentionDays ?? 30,
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (stats) {
      setEnabled(stats.enabled);
      setTimeoutMs(stats.timeoutMs);
      setDailyLimit(stats.dailyLimit !== null ? String(stats.dailyLimit) : '');
      setPriority(stats.priority);
    }
  }, [stats]);

  React.useEffect(() => {
    setUnlimitedRetention(currentRetentionDays === null);
    if (currentRetentionDays !== null) {
      setRetentionDays(currentRetentionDays);
    }
  }, [currentRetentionDays]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', onKeyDown);
    }
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const parsedLimit = dailyLimit.trim() === '' ? null : parseInt(dailyLimit.trim(), 10);
    if (parsedLimit !== null && (isNaN(parsedLimit) || parsedLimit <= 0)) {
      setError('Daily quota limit must be a positive number or left empty for unlimited.');
      setSaving(false);
      return;
    }

    if (timeoutMs < 500 || timeoutMs > 30000) {
      setError('Timeout must be between 500ms and 30,000ms.');
      setSaving(false);
      return;
    }

    if (!unlimitedRetention && retentionDays < 7) {
      setError('Log retention period must be at least 7 days.');
      setSaving(false);
      return;
    }

    try {
      const res = await updateBarcodeApiConfigAction({
        providers: {
          [providerKey]: {
            enabled,
            timeoutMs,
            dailyLimit: parsedLimit,
            priority,
          },
        },
        retentionDays: unlimitedRetention ? null : retentionDays,
      });

      if (res.ok) {
        onSaved();
        onClose();
      } else {
        setError(res.code || 'Failed to save provider configuration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-border bg-white shadow-dropdown overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[#FAFAF8]">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-[#3A8F6F]" />
            <div>
              <h2 id="settings-modal-title" className="text-base font-bold text-[#2C2C28] font-display">
                Configure {stats?.name || providerKey}
              </h2>
              <p className="text-xs text-[#8C8C85]">
                Adjust timeouts, quota limits, and database log retention policies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="flex items-center justify-center h-11 w-11 rounded-xl text-[#8C8C85] hover:text-[#2C2C28] hover:bg-[#F0F0ED] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-[#E0442A] flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Enable / Disable toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-[#FAFAF8]">
            <div>
              <label htmlFor="provider-enabled" className="text-xs font-bold text-[#2C2C28] block">
                Provider Status
              </label>
              <p className="text-[11px] text-[#8C8C85]">
                When disabled, all external queries to this provider are bypassed immediately.
              </p>
            </div>
            <input
              id="provider-enabled"
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-5 w-5 rounded-md text-[#4BAE8A] focus:ring-[#4BAE8A] accent-[#4BAE8A] cursor-pointer"
            />
          </div>

          {/* Timeout */}
          <div>
            <label htmlFor="provider-timeout" className="block text-xs font-semibold text-[#2C2C28] mb-1">
              HTTP Timeout Budget (milliseconds)
            </label>
            <p className="text-[11px] text-[#8C8C85] mb-1.5">
              Circuit breaker timeout is automatically adjusted to (timeout + 500ms).
            </p>
            <Input
              id="provider-timeout"
              type="number"
              min={500}
              max={30000}
              step={100}
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(parseInt(e.target.value, 10) || 3000)}
              className="h-10 text-xs bg-white rounded-xl border-border"
            />
          </div>

          {/* Daily Quota Limit */}
          <div>
            <label htmlFor="daily-limit" className="block text-xs font-semibold text-[#2C2C28] mb-1">
              Daily Request Quota Limit (UTC Day)
            </label>
            <p className="text-[11px] text-[#8C8C85] mb-1.5">
              Atomic Redis counter cap. Leave blank for unlimited requests (e.g. OpenFoodFacts).
            </p>
            <Input
              id="daily-limit"
              type="number"
              min={1}
              placeholder="e.g. 100 for UPCitemdb trial tier"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              className="h-10 text-xs bg-white rounded-xl border-border"
            />
          </div>

          {/* Priority */}
          <div>
            <label htmlFor="priority" className="block text-xs font-semibold text-[#2C2C28] mb-1">
              Resolution Priority (1 - 100)
            </label>
            <p className="text-[11px] text-[#8C8C85] mb-1.5">
              Lower number indicates higher priority during concurrent provider races.
            </p>
            <Input
              id="priority"
              type="number"
              min={1}
              max={100}
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value, 10) || 10)}
              className="h-10 text-xs bg-white rounded-xl border-border"
            />
          </div>

          {/* Global Log Retention Setting */}
          <div className="pt-3 border-t border-border/70">
            <h4 className="text-xs font-bold text-[#2C2C28] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Database size={14} className="text-[#3A8F6F]" />
              Historical Call Log Retention Policy
            </h4>

            <div className="space-y-2.5 p-3 rounded-xl bg-[#FAFAF8] border border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#2C2C28] font-medium">
                  Unlimited Retention (Never Prune)
                </span>
                <input
                  type="checkbox"
                  checked={unlimitedRetention}
                  onChange={(e) => setUnlimitedRetention(e.target.checked)}
                  className="h-4 w-4 rounded-md text-[#4BAE8A] focus:ring-[#4BAE8A] accent-[#4BAE8A] cursor-pointer"
                />
              </div>

              {!unlimitedRetention && (
                <div>
                  <label htmlFor="retention-days" className="block text-[11px] text-[#8C8C85] mb-1">
                    Retention Window (Days, minimum 7):
                  </label>
                  <Input
                    id="retention-days"
                    type="number"
                    min={7}
                    max={365}
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(parseInt(e.target.value, 10) || 30)}
                    className="h-9 text-xs bg-white rounded-xl border-border"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-10 min-h-[44px] min-w-[44px] px-4 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="h-10 min-h-[44px] min-w-[44px] px-5 text-xs font-semibold bg-[#4BAE8A] hover:bg-[#3A8F6F] text-white shadow-xs"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
