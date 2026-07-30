'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { reorderProductPhotosAction, removeProductPhotoAction } from '@/lib/actions';
import { actionErrorMessage } from '@/lib/action-result';
import { resolveAdminPhotoUrl } from '@/lib/admin-media';

interface Photo {
  id: string;
  position: number;
  thumbnailUrl: string;
  displayUrl: string;
}

/**
 * Direct admin correction of a live product's own photo set — reorder (cover =
 * position 0) and remove. Uses the creator-facing photo routes directly
 * (`checkPhotoMutablePolicy` grants the admin role a bypass of the ownership
 * check and audit-logs the mutation), not a moderation decision. Up/down
 * buttons keep reordering keyboard-accessible; drag-and-drop is not the only way
 * to act.
 */
export function ProductPhotoManager({ productId, photos }: { productId: string; photos: Photo[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [order, setOrder] = useState(() => [...photos].sort((a, b) => a.position - b.position));
  const [err, setErr] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  function persistOrder(next: Photo[]) {
    setOrder(next);
    setErr(null);
    setConflict(false);
    startTransition(async () => {
      const result = await reorderProductPhotosAction(productId, next.map((p) => p.id));
      if (!result.ok) {
        setErr(actionErrorMessage(result));
        if (result.code === 'version_conflict') setConflict(true);
      }
    });
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target]!, next[index]!];
    persistOrder(next);
  }

  function remove(photoId: string) {
    if (!window.confirm('Remove this photo from the product? This cannot be undone.')) return;
    setErr(null);
    setConflict(false);
    startTransition(async () => {
      const result = await removeProductPhotoAction(productId, photoId);
      if (result.ok) {
        setOrder((prev) => prev.filter((p) => p.id !== photoId));
      } else {
        setErr(actionErrorMessage(result));
        if (result.code === 'version_conflict') setConflict(true);
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">Photos</h2>
      {order.length === 0 && <p className="text-xs text-muted-foreground">No photos.</p>}
      <ul className="flex flex-wrap gap-3">
        {order.map((p, i) => (
          <li key={p.id} className="flex flex-col items-center gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveAdminPhotoUrl('product', productId, p, 'thumb')}
              alt={i === 0 ? 'Cover photo' : `Photo ${i + 1}`}
              className="h-20 w-20 rounded border object-cover"
            />
            {i === 0 && <span className="text-[10px] text-neutral-mid">Cover</span>}
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Move photo earlier"
                disabled={pending || i === 0}
                onClick={() => move(i, -1)}
                className="text-xs disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Move photo later"
                disabled={pending || i === order.length - 1}
                onClick={() => move(i, 1)}
                className="text-xs disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                aria-label="Remove photo"
                disabled={pending}
                onClick={() => remove(p.id)}
                className="text-xs text-expired disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
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
