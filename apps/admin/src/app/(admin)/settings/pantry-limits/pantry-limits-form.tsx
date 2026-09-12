'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { savePantryLimitsAction } from '@/lib/actions';
import type { PantryLimitsSettings } from '@expyrico/shared';
import {
  Info,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  Layers,
  AlertTriangle,
  Crown,
} from 'lucide-react';

const PRESETS = [
  { name: 'Standard (50)', value: 50 },
  { name: 'Extended (100)', value: 100 },
  { name: 'Power (250)', value: 250 },
  { name: 'Generous (500)', value: 500 },
];

export function PantryLimitsForm({ initial }: { initial: PantryLimitsSettings }) {
  const [pending, startTransition] = useTransition();
  const [limit, setLimit] = useState<number>(initial.defaultUserPantryLimit);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showDecreaseModal, setShowDecreaseModal] = useState<boolean>(false);

  const clamp = (val: number) => Math.max(1, Math.min(10000, val));

  const applyPreset = (val: number) => {
    setLimit(val);
    setErr(null);
    setMsg(null);
  };

  const executeSave = (validLimit: number) => {
    setShowDecreaseModal(false);
    startTransition(async () => {
      try {
        await savePantryLimitsAction({
          defaultUserPantryLimit: validLimit,
        });
        setMsg(`Pantry item limit set to ${validLimit} items successfully.`);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Failed to save settings.');
      }
    });
  };

  const handleSaveClick = () => {
    setErr(null);
    setMsg(null);

    const validLimit = clamp(Math.round(limit));

    // Deliberate decrease confirmation modal intercept
    if (validLimit < initial.defaultUserPantryLimit) {
      setShowDecreaseModal(true);
      return;
    }

    executeSave(validLimit);
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm space-y-8">
        {/* Quick Presets */}
        <div>
          <label className="text-xs font-semibold text-neutral-mid uppercase tracking-wider block mb-2">
            Recommended Capacity Presets
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => {
              const isActive = limit === preset.value;
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset.value)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    isActive
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-stone-200 text-neutral-mid hover:border-stone-300 hover:text-neutral-dark'
                  }`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Input & Stepper Section */}
        <div className="p-4 rounded-xl border border-stone-200/80 bg-stone-50/50 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-dark">Maximum Active Pantry Items</h3>
            <p className="text-xs text-neutral-mid mt-0.5">
              Enforced per user across all personal records and household records created by the user.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLimit((prev) => clamp(prev - 5))}
              disabled={limit <= 1 || pending}
              aria-label="Decrease pantry limit by 5"
              className="w-10 h-10 rounded-lg border border-stone-300 bg-white flex items-center justify-center text-neutral-dark hover:bg-stone-100 disabled:opacity-40 transition"
            >
              <Minus size={16} />
            </button>
            <div className="flex-1">
              <input
                type="number"
                min={1}
                max={10000}
                value={limit}
                onChange={(e) => setLimit(clamp(Number(e.target.value) || 1))}
                disabled={pending}
                className="w-full text-center font-display font-bold text-3xl text-neutral-dark bg-transparent focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setLimit((prev) => clamp(prev + 5))}
              disabled={limit >= 10000 || pending}
              aria-label="Increase pantry limit by 5"
              className="w-10 h-10 rounded-lg border border-stone-300 bg-white flex items-center justify-center text-neutral-dark hover:bg-stone-100 disabled:opacity-40 transition"
            >
              <Plus size={16} />
            </button>
          </div>
          <p className="text-[11px] text-neutral-mid text-center">Allowed range: 1 to 10,000 items</p>
        </div>

        {/* Storage & Soft Ceiling Notes */}
        <div className="space-y-3 pt-2">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-neutral-mid leading-relaxed">
            <Info className="text-neutral-mid shrink-0 mt-0.5" size={16} />
            <div>
              <span className="font-semibold text-neutral-dark">Soft Ceiling Architecture: </span>
              Decreasing the limit blocks new active additions on accounts currently at or above the new limit. Existing inventory is never deleted, hidden, or locked out. Users can freely view, edit, consume, and discard existing records.
            </div>
          </div>
        </div>

        {/* Feedback Alerts */}
        {msg && (
          <div className="flex items-center gap-2 text-xs font-medium text-primary bg-[#D6F0E6] p-3 rounded-lg border border-primary/30" role="status">
            <CheckCircle2 size={16} />
            <span>{msg}</span>
          </div>
        )}

        {err && (
          <div className="flex items-center gap-2 text-xs font-medium text-red-600 bg-red-50 p-3 rounded-lg border border-red-200" role="alert">
            <AlertCircle size={16} />
            <span>{err}</span>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSaveClick} disabled={pending} className="min-w-[140px]">
            {pending ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      {/* Future Tier Architecture Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Crown size={14} />
          <span>Future Tier Architecture</span>
        </div>
        <h3 className="text-lg font-bold text-neutral-dark font-display">Subscription Tier Allocations</h3>
        <p className="text-xs text-neutral-mid leading-relaxed">
          The database schema and shared contracts include forward-compatible tier hooks. When subscription billing is enabled in an upcoming release, accounts will automatically resolve quotas by tier:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-dark">Free Tier</span>
              <span className="text-xs font-mono font-bold text-neutral-dark">{initial.tierLimits?.free ?? 50} items</span>
            </div>
            <p className="text-[11px] text-neutral-mid mt-1">Default allowance for standard accounts.</p>
          </div>
          <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">Pro Tier</span>
              <span className="text-xs font-mono font-bold text-primary">{initial.tierLimits?.pro ?? 500} items</span>
            </div>
            <p className="text-[11px] text-neutral-mid mt-1">High-capacity allowance for power users and large households.</p>
          </div>
        </div>
      </div>

      {/* Decrease Confirmation Modal */}
      {showDecreaseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <h2 className="text-base font-bold text-neutral-dark">Confirm Limit Reduction</h2>
            </div>
            <p className="text-xs text-neutral-mid leading-relaxed">
              Are you sure you want to reduce the default pantry limit from{' '}
              <strong className="text-neutral-dark">{initial.defaultUserPantryLimit}</strong> to{' '}
              <strong className="text-neutral-dark">{limit}</strong> items?
            </p>
            <p className="text-xs text-neutral-mid leading-relaxed">
              Existing users with more than <strong>{limit}</strong> items will not lose any data, but they will be unable to add new active items until they free up space or their limit is increased.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDecreaseModal(false)}
                className="px-4 py-2 text-xs font-medium text-neutral-dark hover:bg-stone-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeSave(limit)}
                className="px-4 py-2 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition shadow-sm"
              >
                Confirm Reduction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
