'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { setDealStatusAction } from '@/lib/actions';

/** Status controls for a single deal: hide / restore / soft-delete. */
export function DealActions({
  id,
  status,
}: {
  id: string;
  status: 'visible' | 'hidden' | 'deleted';
}) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function set(next: 'visible' | 'hidden' | 'deleted', confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setErr(null);
    startTransition(async () => {
      try {
        await setDealStatusAction(id, next);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Action failed');
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status !== 'visible' && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => set('visible')}>
            Restore
          </Button>
        )}
        {status !== 'hidden' && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => set('hidden')}
          >
            Hide
          </Button>
        )}
        {status !== 'deleted' && (
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => set('deleted', 'Soft-delete this deal?')}
          >
            Delete
          </Button>
        )}
      </div>
      {pending && <p className="text-xs text-muted-foreground">Working…</p>}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
