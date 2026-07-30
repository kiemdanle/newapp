'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolveProductEditAction } from '@/lib/actions';
import { actionErrorMessage, isConflictCode } from '@/lib/action-result';

/**
 * Approve/request-changes decision for a pending revision (`ProductEdit`).
 * `request_changes` requires a non-empty reason — the API rejects it otherwise.
 * This route reads/supplies its own version token server-side, so the realistic
 * conflicts an admin hits here are `edit_base_stale` (live product moved since
 * this revision was based on it) and `conflict` ("already resolved") — both
 * treated the same as `version_conflict` (reviewer-p6 M2): never auto-retry,
 * require an explicit refresh, which re-fetches the edit's current state (and,
 * for a stale base, swaps this panel for the recovery actions).
 */
export function PendingActions({ editId }: { editId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  function decide(decision: 'approve' | 'request_changes', reasonNotes?: string) {
    setErr(null);
    setConflict(false);
    startTransition(async () => {
      const result = await resolveProductEditAction(editId, decision, reasonNotes);
      if (result.ok) {
        // Resolved either way — this revision leaves the queue, so return to it
        // rather than leaving the admin on a now-stale detail page.
        router.push('/products/pending');
        return;
      }
      setErr(actionErrorMessage(result));
      if (isConflictCode(result.code)) setConflict(true);
    });
  }

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
            onClick={() => decide('request_changes', trimmedNotes)}
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
        {err && <p className="text-xs text-destructive">{err}</p>}
        {conflict && (
          <Button variant="outline" size="sm" onClick={() => router.refresh()}>
            Refresh
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            if (window.confirm('Approve this revision? It publishes to the live catalog immediately.')) {
              decide('approve');
            }
          }}
        >
          Approve
        </Button>
        <Button
          variant="accent"
          size="sm"
          disabled={pending}
          onClick={() => setRequestingChanges(true)}
        >
          Request Changes
        </Button>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      {conflict && (
        <Button variant="outline" size="sm" onClick={() => router.refresh()}>
          Refresh
        </Button>
      )}
    </div>
  );
}
