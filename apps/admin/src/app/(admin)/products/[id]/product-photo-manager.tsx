'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { reorderProductPhotosAction, removeProductPhotoAction } from '@/lib/actions';
import { actionErrorMessage, isConflictCode } from '@/lib/action-result';
import { resolveAdminPhotoUrl } from '@/lib/admin-media';
import { Image as ImageIcon, ArrowUp, ArrowDown, Trash2, RefreshCw } from 'lucide-react';

interface Photo {
  id: string;
  position: number;
  thumbnailUrl: string;
  displayUrl: string;
}

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
      const photoIds = next.map((p) => p.id);
      const res = await reorderProductPhotosAction(productId, photoIds);
      if (!res.ok) {
        setErr(actionErrorMessage(res));
        if (isConflictCode(res.code)) setConflict(true);
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
    if (!window.confirm('Delete this photo from the product?')) return;
    setErr(null);
    setConflict(false);
    startTransition(async () => {
      const res = await removeProductPhotoAction(productId, photoId);
      if (res.ok) {
        setOrder((prev) => prev.filter((p) => p.id !== photoId));
      } else {
        setErr(actionErrorMessage(res));
        if (isConflictCode(res.code)) setConflict(true);
      }
    });
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-card space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-neutral-dark font-display">
            Photo Gallery Manager ({order.length})
          </h2>
        </div>
        <p className="text-xs text-neutral-mid hidden sm:inline">Position 0 serves as the primary catalog cover image</p>
      </div>

      {order.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-neutral-200 text-neutral-mid text-xs">
          <ImageIcon size={28} className="mb-2 text-neutral-mid/50" />
          <span>No photos attached to this product catalog entry.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {order.map((photo, i) => (
            <div
              key={photo.id}
              className="group relative rounded-2xl border border-neutral-200/80 bg-white p-3 shadow-2xs hover:shadow-xs transition-all space-y-2.5"
            >
              <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-neutral-light/50 border border-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveAdminPhotoUrl('product', productId, photo, 'thumb')}
                  alt={`Photo ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                <span
                  className={`absolute top-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-bold text-white shadow-xs ${
                    i === 0 ? 'bg-primary' : 'bg-neutral-dark/80'
                  }`}
                >
                  {i === 0 ? 'Cover Photo' : `Position ${i}`}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-1 pt-1 border-t border-neutral-100">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending || i === 0}
                    onClick={() => move(i, -1)}
                    className="h-7 w-7 p-0 rounded-lg"
                    title="Move earlier in order"
                  >
                    <ArrowUp size={13} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending || i === order.length - 1}
                    onClick={() => move(i, 1)}
                    className="h-7 w-7 p-0 rounded-lg"
                    title="Move later in order"
                  >
                    <ArrowDown size={13} />
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={() => remove(photo.id)}
                  className="h-7 w-7 p-0 rounded-lg text-red-600 hover:bg-red-50"
                  title="Delete this photo"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {err && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-red-50 p-3 text-xs text-destructive border border-red-200/80">
          <span>{err}</span>
          {conflict && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-lg text-xs"
              onClick={() => router.refresh()}
            >
              <RefreshCw size={12} className="mr-1" />
              <span>Refresh</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
