'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolveProductEditAction } from '@/lib/actions';

/** Approve/request-changes actions for a pending product edit. `request_changes`
 * requires a non-empty reason — the API rejects it otherwise. This is a minimal
 * functional control; Phase 6 owns the full moderation UI. */
export function PendingActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [notes, setNotes] = useState('');

  if (requestingChanges) {
    const trimmedNotes = notes.trim();
    return (
      <div className="flex flex-col gap-2">
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Reason for requesting changes"
          disabled={pending}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={pending || trimmedNotes.length === 0}
            onClick={() =>
              startTransition(async () => {
                await resolveProductEditAction(id, 'request_changes', trimmedNotes);
                setRequestingChanges(false);
                setNotes('');
              })
            }
          >
            Send
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => {
              setRequestingChanges(false);
              setNotes('');
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

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
        onClick={() => setRequestingChanges(true)}
      >
        Request Changes
      </Button>
    </div>
  );
}
