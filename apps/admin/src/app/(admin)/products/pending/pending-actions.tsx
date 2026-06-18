'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { resolveProductEditAction } from '@/lib/actions';

/** Approve/reject buttons for a pending product edit. */
export function PendingActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => resolveProductEditAction(id, 'approve'))}
      >
        Approve
      </Button>
      <Button
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => resolveProductEditAction(id, 'reject'))}
      >
        Reject
      </Button>
    </div>
  );
}
