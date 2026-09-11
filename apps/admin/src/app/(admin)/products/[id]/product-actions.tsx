'use client';
import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { patchProductAction, moderateProductAction } from '@/lib/actions';
import { actionErrorMessage, isConflictCode, type ActionResult } from '@/lib/action-result';
import { ShieldCheck, Edit, Check, AlertCircle, RefreshCw, Send, X, RotateCcw } from 'lucide-react';

export function ProductActions({
  id,
  version: initialVersion,
  name: initialName,
  brand: initialBrand,
  category: initialCategory,
  description: initialDescription,
  barcode: initialBarcode,
  defaultShelfLifeDays: initialDefaultShelfLifeDays,
  status,
  priorFeedback,
}: {
  id: string;
  version: number;
  name: string;
  brand: string | null;
  category: string | null;
  description?: string | null;
  barcode?: string | null;
  defaultShelfLifeDays?: number | null;
  status: string;
  priorFeedback: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [version, setVersion] = useState(initialVersion);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [userEditedFields, setUserEditedFields] = useState<Set<string>>(new Set());
  const [overlappingConflicts, setOverlappingConflicts] = useState<string[]>([]);

  const [baseline, setBaseline] = useState({
    name: initialName,
    brand: initialBrand ?? '',
    category: initialCategory ?? '',
    description: initialDescription ?? '',
    barcode: initialBarcode ?? '',
    defaultShelfLifeDays:
      initialDefaultShelfLifeDays !== null && initialDefaultShelfLifeDays !== undefined
        ? String(initialDefaultShelfLifeDays)
        : '',
  });

  const [form, setForm] = useState(baseline);
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [moderationNotes, setModerationNotes] = useState('');
  const needsModeration = status === 'pending';
  const awaitingResubmission = status === 'changes_required';

  const isDirty = userEditedFields.size > 0;

  function updateField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setUserEditedFields((prev) => {
      const next = new Set(prev);
      if (value !== baseline[key]) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
    setOverlappingConflicts((prev) => prev.filter((f) => f !== key));
  }

  useEffect(() => {
    if (initialVersion === version) return;

    const nextBaseline = {
      name: initialName,
      brand: initialBrand ?? '',
      category: initialCategory ?? '',
      description: initialDescription ?? '',
      barcode: initialBarcode ?? '',
      defaultShelfLifeDays:
        initialDefaultShelfLifeDays !== null && initialDefaultShelfLifeDays !== undefined
          ? String(initialDefaultShelfLifeDays)
          : '',
    };

    const detectedOverlaps: string[] = [];
    const mergedForm = { ...form };

    (Object.keys(nextBaseline) as (keyof typeof nextBaseline)[]).forEach((key) => {
      const serverChanged = nextBaseline[key] !== baseline[key];
      const userChanged = userEditedFields.has(key);

      if (serverChanged && userChanged) {
        detectedOverlaps.push(key);
      } else if (serverChanged && !userChanged) {
        mergedForm[key] = nextBaseline[key];
      }
    });

    setVersion(initialVersion);
    setBaseline(nextBaseline);
    setForm(mergedForm);

    if (detectedOverlaps.length > 0) {
      setOverlappingConflicts(detectedOverlaps);
      setErr(`Concurrent edit conflict on: ${detectedOverlaps.join(', ')}. Please review before saving.`);
      setConflict(true);
    } else {
      setOverlappingConflicts([]);
      setConflict(false);
      setErr(null);
    }
  }, [
    initialVersion,
    initialName,
    initialBrand,
    initialCategory,
    initialDescription,
    initialBarcode,
    initialDefaultShelfLifeDays,
    version,
    baseline,
    form,
    userEditedFields,
  ]);

  function run<T>(fn: () => Promise<ActionResult<T>>, confirmText?: string, onSuccess?: (data?: T) => void) {
    if (confirmText && !window.confirm(confirmText)) return;
    setErr(null);
    setMsg(null);
    setConflict(false);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setMsg('Saved.');
        onSuccess?.(result.data);
        return;
      }
      setErr(actionErrorMessage(result));
      if (isConflictCode(result.code)) setConflict(true);
    });
  }

  function validate(): string | null {
    if (!form.name.trim()) {
      return 'Product name is required.';
    }
    // Barcode policy: once set, cannot be cleared to empty/null
    if (baseline.barcode && !form.barcode.trim()) {
      return 'Existing barcode cannot be removed once set.';
    }
    if (form.barcode.trim()) {
      const bc = form.barcode.trim();
      if (bc.length < 6 || bc.length > 64 || !/^[A-Za-z0-9\-_.:]+$/.test(bc)) {
        return 'Barcode must be between 6 and 64 alphanumeric characters.';
      }
    }
    if (form.defaultShelfLifeDays.trim()) {
      const trimmed = form.defaultShelfLifeDays.trim();
      if (!/^\d+$/.test(trimmed)) {
        return 'Default shelf life must be a whole number between 1 and 3650 days.';
      }
      const parsed = parseInt(trimmed, 10);
      if (parsed < 1 || parsed > 3650) {
        return 'Default shelf life must be a whole number between 1 and 3650 days.';
      }
    }
    return null;
  }

  function handleSave() {
    if (overlappingConflicts.length > 0) {
      setErr(`Please resolve concurrent conflict on: ${overlappingConflicts.join(', ')} before saving.`);
      return;
    }
    const validationError = validate();
    if (validationError) {
      setErr(validationError);
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      category: form.category.trim() || null,
      description: form.description.trim() || null,
    };

    if (form.barcode.trim()) {
      payload.barcode = form.barcode.trim();
    }

    if (form.defaultShelfLifeDays.trim()) {
      payload.defaultShelfLifeDays = parseInt(form.defaultShelfLifeDays.trim(), 10);
    } else {
      payload.defaultShelfLifeDays = null;
    }

    run(
      () => patchProductAction(id, version, payload),
      undefined,
      (updatedProduct) => {
        if (updatedProduct && typeof updatedProduct === 'object' && 'version' in updatedProduct) {
          const v = (updatedProduct as { version: number }).version;
          setVersion(v);
        }
        setBaseline({ ...form });
        setUserEditedFields(new Set());
        setOverlappingConflicts([]);
      },
    );
  }

  function formatShelfLifeHelper(daysStr: string) {
    const days = parseInt(daysStr.trim(), 10);
    if (!days || isNaN(days) || days <= 0) return null;
    if (days >= 365) {
      const years = (days / 365).toFixed(1).replace('.0', '');
      return `≈ ${years} year${years === '1' ? '' : 's'}`;
    }
    if (days >= 30) {
      const months = Math.round(days / 30);
      return `≈ ${months} month${months === 1 ? '' : 's'}`;
    }
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Moderation Box if pending */}
      {needsModeration && (
        <div className="rounded-3xl border border-primary/30 bg-primary/5 p-6 sm:p-8 shadow-card space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-neutral-dark font-display">
              Submission Moderation
            </h2>
          </div>
          <p className="text-xs text-neutral-mid leading-relaxed">
            This is a brand-new creator submission awaiting approval before entering the live public catalog.
          </p>

          {requestingChanges ? (
            <div className="space-y-3 pt-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
                Reason for requesting changes
              </Label>
              <Input
                value={moderationNotes}
                onChange={(e) => setModerationNotes(e.target.value)}
                placeholder="Explain what the creator needs to update or correct…"
                disabled={pending}
                className="h-11 rounded-xl"
                autoFocus
              />
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  disabled={pending || moderationNotes.trim().length === 0}
                  className="rounded-xl gap-1.5"
                  onClick={() =>
                    run(
                      () => moderateProductAction(id, 'request_changes', version, moderationNotes.trim()),
                      undefined,
                      () => {
                        setRequestingChanges(false);
                        setModerationNotes('');
                      },
                    )
                  }
                >
                  <Send size={14} />
                  <span>Send feedback</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  className="rounded-xl"
                  onClick={() => setRequestingChanges(false)}
                >
                  <X size={14} />
                  <span>Cancel</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                size="default"
                disabled={pending}
                className="rounded-xl gap-1.5 font-semibold shadow-xs"
                onClick={() =>
                  run(
                    () => moderateProductAction(id, 'approve', version),
                    'Approve and publish this product to the live catalog?',
                    () => router.refresh(),
                  )
                }
              >
                <Check size={16} />
                <span>Approve & publish to catalog</span>
              </Button>
              <Button
                variant="outline"
                size="default"
                disabled={pending}
                className="rounded-xl"
                onClick={() => setRequestingChanges(true)}
              >
                Request changes
              </Button>
            </div>
          )}
        </div>
      )}

      {awaitingResubmission && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-6 shadow-card space-y-2">
          <h2 className="text-sm font-bold text-amber-900 font-display">Awaiting creator resubmission</h2>
          <p className="text-xs text-amber-800/80 leading-relaxed">
            This submission was returned to its creator for changes and will reappear in the queue once resubmitted.
          </p>
          {priorFeedback && (
            <div className="mt-3 rounded-xl border border-amber-200/80 bg-white p-3 text-xs text-neutral-dark">
              <span className="font-semibold text-amber-900 block mb-0.5">Feedback sent:</span>
              {priorFeedback}
            </div>
          )}
        </div>
      )}

      {/* Edit Details Form */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-base font-bold text-neutral-dark font-display">
                Direct Catalog Edits
              </h2>
              <p className="text-xs text-neutral-mid">
                Update core metadata for this product entry. All modifications are version-tracked and audited.
              </p>
            </div>
          </div>
          {isDirty && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FEEFC3] border border-[#F5A623]/60 px-2.5 py-0.5 text-xs font-semibold text-[#2C2C28]">
              Unsaved changes
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Product Name */}
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
              Product Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              aria-label="Name"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="h-11 rounded-xl"
              placeholder="e.g. Khẩu trang Kenko 5D"
            />
          </div>

          {/* Brand */}
          <div className="space-y-1.5 md:col-span-1">
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
              Brand
            </Label>
            <Input
              value={form.brand}
              onChange={(e) => updateField('brand', e.target.value)}
              className="h-11 rounded-xl"
              placeholder="e.g. Kenko"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5 md:col-span-1">
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
              Category
            </Label>
            <Input
              value={form.category}
              onChange={(e) => updateField('category', e.target.value)}
              className="h-11 rounded-xl"
              placeholder="e.g. Personal Care"
            />
          </div>

          {/* Barcode */}
          <div className="space-y-1.5 md:col-span-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
                Barcode / EAN
              </Label>
              {baseline.barcode && (
                <span className="text-[10px] text-neutral-mid">Cannot be cleared once set</span>
              )}
            </div>
            <Input
              value={form.barcode}
              onChange={(e) => updateField('barcode', e.target.value)}
              className="h-11 rounded-xl font-mono"
              placeholder="e.g. 8936012345678"
            />
          </div>

          {/* Default Shelf Life */}
          <div className="space-y-1.5 md:col-span-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
                Shelf Life (Days)
              </Label>
              {formatShelfLifeHelper(form.defaultShelfLifeDays) && (
                <span className="text-[10px] text-primary font-medium">
                  {formatShelfLifeHelper(form.defaultShelfLifeDays)}
                </span>
              )}
            </div>
            <Input
              type="number"
              min="1"
              max="3650"
              value={form.defaultShelfLifeDays}
              onChange={(e) => updateField('defaultShelfLifeDays', e.target.value)}
              className="h-11 rounded-xl"
              placeholder="e.g. 365"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5 md:col-span-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
              Product Description
            </Label>
            <textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-input bg-transparent px-3 py-2.5 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-neutral-mid/60 leading-relaxed resize-y"
              placeholder="Detailed product specification, ingredients, usage instructions, or packaging notes…"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-neutral-100">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="default"
              disabled={pending || !isDirty}
              aria-label="Save changes"
              className="rounded-xl shadow-xs gap-1.5 font-semibold"
              onClick={handleSave}
            >
              <Check size={16} />
              <span>{pending ? 'Saving…' : 'Save changes'}</span>
            </Button>

            {isDirty && (
              <Button
                variant="outline"
                size="default"
                disabled={pending}
                className="rounded-xl gap-1.5 text-neutral-mid hover:text-neutral-dark"
                onClick={() => {
                  setForm(baseline);
                  setUserEditedFields(new Set());
                  setOverlappingConflicts([]);
                  setErr(null);
                }}
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </Button>
            )}

            {status === 'active' && (
              <Button
                variant="destructive"
                size="default"
                disabled={pending}
                className="rounded-xl bg-[#E0442A] text-white hover:bg-[#E0442A]/90"
                onClick={() =>
                  run(
                    () => patchProductAction(id, version, { status: 'report_hidden' }),
                    'Hide this product from search? Existing pantry references will stay intact.',
                  )
                }
              >
                Hide from search
              </Button>
            )}

            {status === 'report_hidden' && (
              <Button
                variant="outline"
                size="default"
                disabled={pending}
                className="rounded-xl"
                onClick={() =>
                  run(
                    () => patchProductAction(id, version, { status: 'active' }),
                    'Restore this product to search?',
                  )
                }
              >
                Restore to search
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {msg && <span className="text-xs font-semibold text-[#3A8F6F]">{msg}</span>}
            {err && <span className="text-xs font-semibold text-[#E0442A]">{err}</span>}
            {conflict && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1"
                onClick={() => router.refresh()}
              >
                <RefreshCw size={14} />
                <span>Refresh latest</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
