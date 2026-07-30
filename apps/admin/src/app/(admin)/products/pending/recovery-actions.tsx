'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductEditRecoverRequest } from '@expyrico/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { recoverProductEditAction } from '@/lib/actions';
import { actionErrorMessage, isConflictCode } from '@/lib/action-result';
import { resolveAdminPhotoUrl } from '@/lib/admin-media';

const MAX_PHOTOS = 5;

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

function candidateKey(c: Candidate): string {
  return c.kind === 'retained' ? `retained:${c.sourceProductPhotoId}` : `staged:${c.editPhotoId}`;
}

function candidateId(c: Candidate): string {
  return c.kind === 'retained' ? c.sourceProductPhotoId : c.editPhotoId;
}

function CandidateThumb({
  candidate,
  productId,
  editId,
}: {
  candidate: Candidate;
  productId: string;
  editId: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolveAdminPhotoUrl(
        candidate.kind === 'retained' ? 'product' : 'edit',
        candidate.kind === 'retained' ? productId : editId,
        { id: candidateId(candidate), thumbnailUrl: candidate.thumbnailUrl, displayUrl: candidate.displayUrl },
        'thumb',
      )}
      alt=""
      className="h-10 w-10 rounded border object-cover"
    />
  );
}

/**
 * Stale-revision recovery: shown only when `liveProductVersion !==
 * baseProductVersion`. **Rebase** requires the admin's own reviewed mapping of
 * which photos to keep — never auto-computed from a diff — built from the two
 * pools that are actually re-referenceable: the product's *current* live photos
 * (`retained`, keyed by their real `ProductPhoto` id) and this revision's own
 * still-staged photos (`staged`, keyed by their `ProductEditPhoto` id).
 *
 * The submitted `desiredPhotoOrder` is rendered directly — a separate
 * "Selected" list, in the exact order/positions that will be sent — rather
 * than an immutable candidate list that visually diverges from what the ↑/↓
 * controls actually reorder. The contract caps `desiredPhotoOrder` at 5
 * entries, enforced here too (disabled "Add" past the cap, `n/5` counter, and
 * a valid capped-at-5 default) so the default state is never a guaranteed
 * 400.
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

  // Valid-by-construction default: capped at MAX_PHOTOS, in natural (live-then
  // -staged) order. The admin trims/reorders/adds from there — never starts
  // from a state guaranteed to exceed the contract's cap.
  const [order, setOrder] = useState<Candidate[]>(() => allCandidates.slice(0, MAX_PHOTOS));

  const orderedKeys = useMemo(() => new Set(order.map(candidateKey)), [order]);
  const available = allCandidates.filter((c) => !orderedKeys.has(candidateKey(c)));
  const atCap = order.length >= MAX_PHOTOS;

  function add(c: Candidate) {
    if (atCap) return;
    setOrder((prev) => [...prev, c]);
  }

  function remove(index: number) {
    setOrder((prev) => prev.filter((_, i) => i !== index));
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
      if (isConflictCode(result.code)) setConflict(true);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">Stale revision recovery</h2>
      <p className="text-xs text-muted-foreground">
        The live product changed since this revision was based on it. Review the desired photo set
        below, then rebase (returns to the queue for re-review) or supersede (closes this revision).
      </p>

      <div>
        <h3 className="mb-1 text-xs font-semibold text-neutral-mid">
          Selected ({order.length}/{MAX_PHOTOS})
        </h3>
        {order.length === 0 && <p className="text-xs text-muted-foreground">No photos selected.</p>}
        <ul className="space-y-1">
          {order.map((c, i) => (
            <li key={candidateKey(c)} className="flex items-center gap-3 rounded border p-2">
              <span className="w-4 text-xs text-neutral-mid">{i + 1}</span>
              <CandidateThumb candidate={c} productId={productId} editId={editId} />
              <span className="flex-1 text-xs text-muted-foreground">
                {c.kind === 'retained' ? 'Currently live' : 'Staged in this revision'}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={pending || i === 0}
                  onClick={() => move(i, -1)}
                  className="disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={pending || i === order.length - 1}
                  onClick={() => move(i, 1)}
                  className="disabled:opacity-30"
                >
                  ↓
                </button>
                {/* Reversible (Add puts it straight back) — never Alert Red,
                    which stays reserved for genuinely destructive actions. */}
                <button
                  type="button"
                  aria-label="Remove from selection"
                  disabled={pending}
                  onClick={() => remove(i)}
                  className="text-neutral-mid hover:text-neutral-dark disabled:opacity-30"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {available.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold text-neutral-mid">Available</h3>
          <ul className="space-y-1">
            {available.map((c) => (
              <li key={candidateKey(c)} className="flex items-center gap-3 rounded border p-2">
                <CandidateThumb candidate={c} productId={productId} editId={editId} />
                <span className="flex-1 text-xs text-muted-foreground">
                  {c.kind === 'retained' ? 'Currently live' : 'Staged in this revision'}
                </span>
                <Button size="sm" variant="outline" disabled={pending || atCap} onClick={() => add(c)}>
                  Add
                </Button>
              </li>
            ))}
          </ul>
          {atCap && <p className="mt-1 text-xs text-muted-foreground">Maximum of {MAX_PHOTOS} photos — remove one to add another.</p>}
        </div>
      )}

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
