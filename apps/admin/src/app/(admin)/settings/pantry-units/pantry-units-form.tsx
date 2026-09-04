'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { savePantryUnitsAction } from '@/lib/actions';
import type { PantryUnitsSettings } from '@expyrico/shared';

const PRESETS = [
  { name: 'Global Packaging (Default)', units: ['pcs', 'pack', 'can', 'bottle'] },
  { name: 'Weight & Produce Focus', units: ['pcs', 'kg', 'g', 'pack'] },
  { name: 'US Customary / Imports', units: ['pcs', 'oz', 'lb', 'pack'] },
];

export function PantryUnitsForm({ initial }: { initial: PantryUnitsSettings }) {
  const [pending, startTransition] = useTransition();
  const [units, setUnits] = useState<string[]>(initial.topUnits);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const updateSlot = (index: number, val: string) => {
    setUnits((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleSave = () => {
    setErr(null);
    setMsg(null);

    // Validation check for 4 non-empty distinct units
    const trimmed = units.map((u) => u.trim().toLowerCase());
    if (trimmed.some((u) => !u)) {
      setErr('All 4 unit slots must be filled.');
      return;
    }
    if (new Set(trimmed).size !== 4) {
      setErr('All 4 units must be distinct (no duplicates).');
      return;
    }

    startTransition(async () => {
      try {
        await savePantryUnitsAction({ topUnits: trimmed });
        setMsg('Pantry units setting saved successfully.');
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Failed to save setting.');
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold text-neutral-dark">Top 4 Primary Units</h2>
        <p className="text-xs text-neutral-mid mt-1">
          These 4 units will be rendered as direct 1-tap pills on mobile. All other units will be accessible through the &quot;More ▾&quot; sheet.
        </p>
      </div>

      {/* Presets */}
      <div>
        <span className="text-xs font-medium text-neutral-mid">Quick Presets:</span>
        <div className="flex flex-wrap gap-2 mt-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => setUnits(preset.units)}
              className="text-xs px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 font-medium text-neutral-dark transition"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Slots */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {units.map((unitVal, i) => (
          <div key={i} className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-mid uppercase tracking-wide">
              Pill Slot {i + 1}
            </label>
            <Input
              value={unitVal}
              onChange={(e) => updateSlot(i, e.target.value)}
              maxLength={16}
              placeholder={`e.g. ${['pcs', 'pack', 'can', 'bottle'][i]}`}
              className="font-medium text-sm"
            />
          </div>
        ))}
      </div>

      {/* Status messages */}
      {msg && <p className="text-xs text-emerald-600 font-medium">{msg}</p>}
      {err && <p className="text-xs text-red-600 font-medium">{err}</p>}

      {/* Action */}
      <div className="pt-2 flex justify-end">
        <Button onClick={handleSave} disabled={pending}>
          {pending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
