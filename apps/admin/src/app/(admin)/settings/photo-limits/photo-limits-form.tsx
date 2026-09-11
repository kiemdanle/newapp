'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { savePhotoLimitsAction } from '@/lib/actions';
import type { PhotoLimitsSettings } from '@expyrico/shared';
import { Info, Sparkles, CheckCircle2, AlertCircle, Plus, Minus } from 'lucide-react';

const PRESETS = [
  { name: 'Standard (5 / 5)', product: 5, pantry: 5 },
  { name: 'Lean & Fast (3 / 3)', product: 3, pantry: 3 },
  { name: 'Detailed Documentation (10 / 10)', product: 10, pantry: 10 },
];

export function PhotoLimitsForm({ initial }: { initial: PhotoLimitsSettings }) {
  const [pending, startTransition] = useTransition();
  const [productPhotos, setProductPhotos] = useState<number>(initial.maxProductPhotos);
  const [pantryPhotos, setPantryPhotos] = useState<number>(initial.maxPantryItemPhotos);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const clamp = (val: number) => Math.max(1, Math.min(20, val));

  const applyPreset = (product: number, pantry: number) => {
    setProductPhotos(product);
    setPantryPhotos(pantry);
    setErr(null);
    setMsg(null);
  };

  const handleSave = () => {
    setErr(null);
    setMsg(null);

    const validProduct = clamp(Math.round(productPhotos));
    const validPantry = clamp(Math.round(pantryPhotos));

    startTransition(async () => {
      try {
        await savePhotoLimitsAction({
          maxProductPhotos: validProduct,
          maxPantryItemPhotos: validPantry,
        });
        setMsg('Photo upload limits saved successfully.');
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Failed to save settings.');
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm space-y-8 max-w-2xl">
      {/* Quick Presets */}
      <div>
        <label className="text-xs font-semibold text-neutral-mid uppercase tracking-wider block mb-2">
          Recommended Configurations
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => {
            const isActive = productPhotos === preset.product && pantryPhotos === preset.pantry;
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyPreset(preset.product, preset.pantry)}
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

      {/* Inputs Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Product Limit Stepper */}
        <div className="space-y-3 p-4 rounded-xl border border-stone-200/80 bg-stone-50/50">
          <div>
            <h3 className="text-sm font-semibold text-neutral-dark">New Products Max</h3>
            <p className="text-xs text-neutral-mid mt-0.5">
              Limits photos for catalog products, private drafts, and revisions.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setProductPhotos((prev) => clamp(prev - 1))}
              disabled={productPhotos <= 1 || pending}
              aria-label="Decrease product photo limit"
              className="w-10 h-10 rounded-lg border border-stone-300 bg-white flex items-center justify-center text-neutral-dark hover:bg-stone-100 disabled:opacity-40 transition"
            >
              <Minus size={16} />
            </button>
            <div className="flex-1 text-center font-display font-bold text-2xl text-neutral-dark">
              {productPhotos}
            </div>
            <button
              type="button"
              onClick={() => setProductPhotos((prev) => clamp(prev + 1))}
              disabled={productPhotos >= 20 || pending}
              aria-label="Increase product photo limit"
              className="w-10 h-10 rounded-lg border border-stone-300 bg-white flex items-center justify-center text-neutral-dark hover:bg-stone-100 disabled:opacity-40 transition"
            >
              <Plus size={16} />
            </button>
          </div>
          <p className="text-[11px] text-neutral-mid text-center">Allowed: 1 to 20 photos</p>
        </div>

        {/* Pantry Item Limit Stepper */}
        <div className="space-y-3 p-4 rounded-xl border border-stone-200/80 bg-stone-50/50">
          <div>
            <h3 className="text-sm font-semibold text-neutral-dark">New Pantry Items Max</h3>
            <p className="text-xs text-neutral-mid mt-0.5">
              Limits photos attached per item in personal & household pantries.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPantryPhotos((prev) => clamp(prev - 1))}
              disabled={pantryPhotos <= 1 || pending}
              aria-label="Decrease pantry item photo limit"
              className="w-10 h-10 rounded-lg border border-stone-300 bg-white flex items-center justify-center text-neutral-dark hover:bg-stone-100 disabled:opacity-40 transition"
            >
              <Minus size={16} />
            </button>
            <div className="flex-1 text-center font-display font-bold text-2xl text-neutral-dark">
              {pantryPhotos}
            </div>
            <button
              type="button"
              onClick={() => setPantryPhotos((prev) => clamp(prev + 1))}
              disabled={pantryPhotos >= 20 || pending}
              aria-label="Increase pantry item photo limit"
              className="w-10 h-10 rounded-lg border border-stone-300 bg-white flex items-center justify-center text-neutral-dark hover:bg-stone-100 disabled:opacity-40 transition"
            >
              <Plus size={16} />
            </button>
          </div>
          <p className="text-[11px] text-neutral-mid text-center">Allowed: 1 to 20 photos</p>
        </div>
      </div>

      {/* Storage & Soft Ceiling Notes */}
      <div className="space-y-3 pt-2">
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-neutral-dark leading-relaxed">
          <Sparkles className="text-primary shrink-0 mt-0.5" size={16} />
          <div>
            <span className="font-semibold text-primary">Automated Storage Optimization: </span>
            All uploads on mobile and admin are automatically resized to max 1920×1920 and compressed under 1 MB using modern WebP format (with JPEG fallback).
          </div>
        </div>

        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-neutral-mid leading-relaxed">
          <Info className="text-neutral-mid shrink-0 mt-0.5" size={16} />
          <div>
            <span className="font-semibold text-neutral-dark">Soft Ceiling Policy: </span>
            Lowering a limit blocks new photo additions on full items, but existing items exceeding the new ceiling remain fully viewable and editable without data loss.
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
        <Button onClick={handleSave} disabled={pending} className="min-w-[140px]">
          {pending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
