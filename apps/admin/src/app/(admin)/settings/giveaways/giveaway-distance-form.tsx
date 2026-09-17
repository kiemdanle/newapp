'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { saveGiveawayDistanceAction } from '@/lib/actions';
import type { GiveawayDistanceSettings } from '@expyrico/shared';
import {
  MapPin,
  CheckCircle2,
  AlertCircle,
  Compass,
  Sliders,
  ShieldCheck,
} from 'lucide-react';

const PRESETS = [
  { name: 'Hyper-Local (10 km)', value: 10 },
  { name: 'Neighbourhood (25 km)', value: 25 },
  { name: 'Metro Area (50 km)', value: 50 },
  { name: 'Regional (100 km)', value: 100 },
];

export function GiveawayDistanceForm({ initial }: { initial: GiveawayDistanceSettings }) {
  const [pending, startTransition] = useTransition();
  const [radius, setRadius] = useState<number>(initial.defaultRadiusKm);
  const [strictDistanceOnly, setStrictDistanceOnly] = useState<boolean>(initial.strictDistanceOnly);
  const [allowUserRadiusOverride, setAllowUserRadiusOverride] = useState<boolean>(
    initial.allowUserRadiusOverride,
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const clampRadius = (val: number) => Math.max(5, Math.min(200, val));

  const handleSave = () => {
    setErr(null);
    setMsg(null);
    const validRadius = clampRadius(Math.round(radius));

    startTransition(async () => {
      try {
        await saveGiveawayDistanceAction({
          defaultRadiusKm: validRadius,
          strictDistanceOnly,
          allowUserRadiusOverride,
        });
        setMsg(`Giveaway distance radius set to ${validRadius} km successfully.`);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Failed to save giveaway distance settings.');
      }
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in duration-200">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in duration-200">
          <AlertCircle size={18} className="text-red-600 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      {/* Main Distance Radius Card */}
      <div className="bg-white border border-neutral-light rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Compass className="text-primary" size={18} />
              <h2 className="text-lg font-bold text-neutral-dark">Search Circle Radius</h2>
            </div>
            <p className="text-xs text-neutral-mid">
              Posts located beyond this distance from the viewer&apos;s coordinates will be excluded from their local feed.
            </p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold font-mono text-primary">{radius}</span>
            <span className="text-xs text-neutral-mid ml-1">km</span>
          </div>
        </div>

        {/* Preset Pills */}
        <div>
          <label className="text-xs font-semibold text-neutral-mid uppercase tracking-wider block mb-2">
            Preset Distances
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESETS.map((p) => {
              const active = radius === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    setRadius(p.value);
                    setMsg(null);
                    setErr(null);
                  }}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all text-center ${
                    active
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-neutral-light/50 border-neutral-light text-neutral-dark hover:bg-neutral-light'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Range Slider */}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-xs text-neutral-mid font-medium">
            <span>5 km (Minimum)</span>
            <span>Custom Distance</span>
            <span>200 km (Maximum)</span>
          </div>
          <input
            type="range"
            min={5}
            max={200}
            step={5}
            value={radius}
            onChange={(e) => {
              setRadius(Number(e.target.value));
              setMsg(null);
              setErr(null);
            }}
            className="w-full accent-primary cursor-pointer h-2 bg-neutral-light rounded-lg appearance-none"
          />
        </div>
      </div>

      {/* Advanced Filtering Rules */}
      <div className="bg-white border border-neutral-light rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 border-b border-neutral-light pb-3">
          <Sliders className="text-primary" size={16} />
          <h3 className="text-sm font-bold text-neutral-dark">Search Circle Behaviors</h3>
        </div>

        {/* Strict Mode Toggle */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-sm font-semibold text-neutral-dark block">Strict Distance Enforced</span>
            <p className="text-xs text-neutral-mid">
              When enabled, distant giveaways are strictly pruned. When zero posts exist within the radius, mobile shows an empty state with a 1-tap button to expand the search.
            </p>
          </div>
          <input
            type="checkbox"
            checked={strictDistanceOnly}
            onChange={(e) => {
              setStrictDistanceOnly(e.target.checked);
              setMsg(null);
            }}
            className="mt-1 h-4 w-4 rounded text-primary focus:ring-primary border-neutral-mid"
          />
        </div>

        {/* User Override Toggle */}
        <div className="flex items-start justify-between gap-4 border-t border-neutral-light/60 pt-4">
          <div className="space-y-1">
            <span className="text-sm font-semibold text-neutral-dark block">Allow Member Distance Override</span>
            <p className="text-xs text-neutral-mid">
              Allow mobile members to adjust their search radius filter in the app filter menu.
            </p>
          </div>
          <input
            type="checkbox"
            checked={allowUserRadiusOverride}
            onChange={(e) => {
              setAllowUserRadiusOverride(e.target.checked);
              setMsg(null);
            }}
            className="mt-1 h-4 w-4 rounded text-primary focus:ring-primary border-neutral-mid"
          />
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={pending}
          className="bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-2.5 rounded-xl transition shadow-sm"
        >
          {pending ? 'Saving Settings…' : 'Save Distance Settings'}
        </Button>
      </div>
    </div>
  );
}
