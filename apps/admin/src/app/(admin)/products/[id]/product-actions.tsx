'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { patchProductAction, moderateProductAction } from '@/lib/actions';
import { actionErrorMessage, isConflictCode, type ActionResult } from '@/lib/action-result';
import { ShieldCheck, Edit, Check, AlertCircle, RefreshCw, Send, X } from 'lucide-react';

export function ProductActions({
  id,
  version,
  name,
  brand,
  category,
  status,
  priorFeedback,
}: {
  id: string;
  version: number;
  name: string;
  brand: string | null;
  category: string | null;
  status: string;
  priorFeedback: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [form, setForm] = useState({ name, brand: brand ?? '', category: category ?? '' });
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [moderationNotes, setModerationNotes] = useState('');
  const needsModeration = status === 'pending';
  const awaitingResubmission = status === 'changes_required';

  function run(fn: () => Promise<ActionResult<unknown>>, confirmText?: string, onSuccess?: () => void) {
    if (confirmText && !window.confirm(confirmText)) return;
    setErr(null);
    setMsg(null);
    setConflict(false);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setMsg('Saved.');
        onSuccess?.();
        return;
      }
      setErr(actionErrorMessage(result));
      if (isConflictCode(result.code)) setConflict(true);
    });
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
                    'Approve this submission? It publishes to the live catalog immediately.',
                  )
                }
              >
                <Check size={16} />
                <span>Approve submission</span>
              </Button>
              <Button
                variant="accent"
                size="default"
                disabled={pending}
                className="rounded-xl font-semibold shadow-xs"
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
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-card space-y-5">
        <div className="flex items-center gap-2">
          <Edit className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-neutral-dark font-display">
            Direct Catalog Edits
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
              Product Name
            </Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
              Brand
            </Label>
            <Input
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
              Category
            </Label>
            <Input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="h-11 rounded-xl"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-neutral-100">
          <div className="flex items-center gap-3">
            <Button
              size="default"
              disabled={pending}
              className="rounded-xl shadow-xs gap-1.5"
              onClick={() =>
                run(() =>
                  patchProductAction(id, version, {
                    name: form.name,
                    brand: form.brand.trim() || null,
                    category: form.category.trim() || null,
                  }),
                )
              }
            >
              <Check size={16} />
              <span>{pending ? 'Saving…' : 'Save core details'}</span>
            </Button>

            {status === 'active' && (
              <Button
                variant="destructive"
                size="default"
                disabled={pending}
                className="rounded-xl"
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
            {msg && <span className="text-xs font-semibold text-emerald-700">{msg}</span>}
            {err && <span className="text-xs font-semibold text-destructive">{err}</span>}
            {conflict && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1"
                onClick={() => router.refresh()}
              >
                <RefreshCw size={14} />
                <span>Refresh</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
