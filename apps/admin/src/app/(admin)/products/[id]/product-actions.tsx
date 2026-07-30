'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { patchProductAction, moderateProductAction } from '@/lib/actions';
import { actionErrorMessage, type ActionResult } from '@/lib/action-result';

/**
 * Client controls for the product-detail page: inline edit of the core fields,
 * a moderation decision when the product is a brand-new creator submission
 * awaiting review, and a link to the dedicated merge tool at
 * /products/[id]/merge. Every mutation drives a server action (audit-logged
 * API-side) in a transition.
 */
export function ProductActions({
  id,
  version,
  name,
  brand,
  category,
  status,
}: {
  id: string;
  version: number;
  name: string;
  brand: string | null;
  category: string | null;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [form, setForm] = useState({ name, brand: brand ?? '', category: category ?? '' });
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [moderationNotes, setModerationNotes] = useState('');
  const needsModeration = status === 'pending' || status === 'changes_required';

  // Never auto-retries against changed content: a `version_conflict` clears any
  // in-flight intent and requires an explicit refresh (which re-fetches the
  // current row, including its new version) before the admin can try again.
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
      } else {
        setErr(actionErrorMessage(result));
        if (result.code === 'version_conflict') setConflict(true);
      }
    });
  }

  return (
    <div className="space-y-6">
      {needsModeration && (
        <div className="space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-semibold">Moderate this submission</h2>
          <p className="text-xs text-muted-foreground">
            This is a brand-new creator submission awaiting review — distinct from a revision to an
            already-active product.
          </p>
          {requestingChanges ? (
            <div className="flex flex-col gap-2">
              <Input
                value={moderationNotes}
                onChange={(e) => setModerationNotes(e.target.value)}
                placeholder="Reason for requesting changes"
                disabled={pending}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={pending || moderationNotes.trim().length === 0}
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
                  Send
                </Button>
                <Button variant="outline" size="sm" disabled={pending} onClick={() => setRequestingChanges(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" disabled={pending} onClick={() => run(() => moderateProductAction(id, 'approve', version))}>
                Approve
              </Button>
              <Button variant="accent" size="sm" disabled={pending} onClick={() => setRequestingChanges(true)}>
                Request Changes
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Edit details</h2>
        <label className="block text-xs text-muted-foreground">
          Name
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1"
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          Brand
          <Input
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
            className="mt-1"
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          Category
          <Input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="mt-1"
          />
        </label>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() =>
              patchProductAction(id, version, {
                name: form.name,
                brand: form.brand || null,
                category: form.category || null,
              }),
            )
          }
        >
          Save changes
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Merge duplicates</h2>
        <p className="text-xs text-muted-foreground">
          Search for duplicate products and fold them into this one. Records and reviews are
          repointed; loser products become <code>merged_into</code>.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/products/${id}/merge`}>Open merge tool</Link>
        </Button>
      </div>

      {pending && <p className="text-xs text-muted-foreground">Working…</p>}
      {msg && <p className="text-xs text-foreground">{msg}</p>}
      {err && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-destructive">{err}</p>
          {conflict && (
            <Button variant="outline" size="sm" onClick={() => router.refresh()}>
              Refresh
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
