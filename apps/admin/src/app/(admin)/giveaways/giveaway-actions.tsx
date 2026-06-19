'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { cancelGiveawayAction } from '@/lib/actions';

export function GiveawayActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function doCancel() {
    if (!window.confirm('Cancel this giveaway?')) return;
    setErr(null);
    startTransition(async () => {
      try {
        await cancelGiveawayAction(id);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Action failed');
      }
    });
  }

  if (status === 'completed' || status === 'cancelled') return null;

  return (
    <div className="space-y-2">
      <Button size="sm" variant="destructive" disabled={pending} onClick={doCancel}>
        Cancel
      </Button>
      {pending && <p className="text-xs text-muted-foreground">Working…</p>}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
