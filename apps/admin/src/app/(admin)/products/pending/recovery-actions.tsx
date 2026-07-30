'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductEditRecoverRequest } from '@expyrico/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { recoverProductEditAction } from '@/lib/actions';
import { actionErrorMessage } from '@/lib/action-result';
import { resolveAdminPhotoUrl } from '@/lib/admin-media';

interface LivePhoto {
  id: string;
  thumbnailUrl: string;
  displayUrl: string;
}

interface StagedEditPhoto {
  id: string;
  thumbnailUrl: string;
  displayUrl: string;
}

type Candidate =
  | { kind: 'retained'; sourceProductPhotoId: string; thumbnailUrl: string; displayUrl: string }
  | { kind: 'staged'; editPhotoId: string; thumbnailUrl: string; displayUrl: string };

/**
 * Stale-revision recovery: shown only when `liveProductVersion !==
 * baseProductVersion`. **Rebase** requires the admin's own reviewed mapping of
 * which photos to keep — never auto-computed from a diff — built from the two
 * pools that are actually re-referenceable: the product's *current* live photos
 * (`retained`, keyed by their real `ProductPhoto` id) and this revision's own
 * still-staged photos (`staged`, keyed by their `ProductEditPhoto` id). Up/down
 * controls (not drag-and-drop) keep photo reordering keyboard-accessible.
 * **Supersede** is destructive (Alert Red) and requires confirmation — it closes
 * the revision as historical `rejected` and frees the creator's one-open-edit
 * slot to start again.
 */
export function RecoveryActions({
  editId,
  editVersion,
  productId,
  productVersion,
  livePhotos,
  stagedEditPhotos,
}: {
  editId: string;
  editVersion: number;
  productId: string;
  productVersion: number;
  livePhotos: LivePhoto[];
  stagedEditPhotos: StagedEditPhoto[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notes, setNotes] = useState('');

  const allCandidates = useMemo<Candidate[]>(
    () => [
      ...livePhotos.map((p): Candidate => ({ kind: 'retained', sourceProductPhotoId: p.id, thumbnailUrl: p.thumbnailUrl, displayUrl: p.displayUrl })),
      ...stagedEditPhotos.map((p): Candidate => ({ kind: 'staged', editPhotoId: p.id, thumbnailUrl: p.thumbnailUrl, displayUrl: p.displayUrl })),
    ],
    [livePhotos, stagedEditPhotos],
  );

  // Defaults to every candidate kept, in its natural (live-then-staged) order —
  // the admin trims/reorders from there rather than starting from nothing.
  const [order, setOrder] = useState<Candidate[]>(allCandidates);

  function candidateKey(c: Candidate): string {
    return c.kind === 'retained' ? `retained:${c.sourceProductPhotoId}` : `staged:${c.editPhotoId}`;
  }

  function toggle(c: Candidate, checked: boolean) {
    setOrder((prev) =>
      checked ? [...prev, c] : prev.filter((x) => candidateKey(x) !== candidateKey(c)),
    );
  }

  function move(index: number, delta: number) {
    setOrder((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function submit(action: 'rebase' | 'supersede') {
    if (action === 'supersede' && !window.confirm('Supersede this revision? It becomes historical and the creator can start a new one.')) {
      return;
    }
    if (action === 'rebase' && order.length === 0) {
      setErr('Keep at least one photo, or supersede this revision instead.');
      return;
    }
    setErr(null);
    setConflict(false);
    const input: ProductEditRecoverRequest =
      action === 'rebase'
        ? {
            action: 'rebase',
            editVersion,
            productVersion,
            desiredPhotoOrder: order.map((c) =>
              c.kind === 'retained'
                ? { type: 'retained' as const, sourceProductPhotoId: c.sourceProductPhotoId }
                : { type: 'staged' as const, editPhotoId: c.editPhotoId },
            ),
            notes: notes.trim() || undefined,
          }
        : { action: 'supersede', editVersion, productVersion, notes: notes.trim() || undefined };

    startTransition(async () => {
      const result = await recoverProductEditAction(editId, input);
      if (result.ok) {
        router.push('/products/pending');
        return;
      }
      setErr(actionErrorMessage(result));
      if (result.code === 'version_conflict') setConflict(true);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">Stale revision recovery</h2>
      <p className="text-xs text-muted-foreground">
        The live product changed since this revision was based on it. Review the desired photo set
        below, then rebase (returns to the queue for re-review) or supersede (closes this revision).
      </p>

      <ul className="space-y-1">
        {allCandidates.map((c) => {
          const key = candidateKey(c);
          const checked = order.some((x) => candidateKey(x) === key);
          const idx = order.findIndex((x) => candidateKey(x) === key);
          return (
            <li key={key} className="flex items-center gap-3 rounded border p-2">
              <input
                type="checkbox"
                aria-label={`Keep ${c.kind === 'retained' ? 'live' : 'staged'} photo`}
                checked={checked}
                onChange={(e) => toggle(c, e.target.checked)}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveAdminPhotoUrl(c.kind === 'retained' ? 'product' : 'edit', c.kind === 'retained' ? productId : editId, { id: c.kind === 'retained' ? c.sourceProductPhotoId : c.editPhotoId, thumbnailUrl: c.thumbnailUrl, displayUrl: c.displayUrl }, 'thumb')}
                alt=""
                className="h-10 w-10 rounded border object-cover"
              />
              <span className="flex-1 text-xs text-muted-foreground">{c.kind === 'retained' ? 'Currently live' : 'Staged in this revision'}</span>
              {checked && (
                <div className="flex gap-1">
                  <button type="button" aria-label="Move up" disabled={idx <= 0} onClick={() => move(idx, -1)} className="disabled:opacity-30">
                    ↑
                  </button>
                  <button type="button" aria-label="Move down" disabled={idx < 0 || idx >= order.length - 1} onClick={() => move(idx, 1)} className="disabled:opacity-30">
                    ↓
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" disabled={pending} />

      <div className="flex items-center justify-end gap-3">
        {err && <span className="text-xs text-destructive">{err}</span>}
        {conflict && (
          <Button variant="outline" size="sm" onClick={() => router.refresh()}>
            Refresh
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={pending} onClick={() => submit('rebase')}>
          Rebase
        </Button>
        <Button variant="destructive" size="sm" disabled={pending} onClick={() => submit('supersede')}>
          Supersede
        </Button>
      </div>
    </div>
  );
}
