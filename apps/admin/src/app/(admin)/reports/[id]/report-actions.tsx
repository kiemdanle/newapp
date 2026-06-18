'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { resolveReportAction } from '@/lib/actions';

/**
 * Resolution controls for a single report. `hide`/`delete`/`ban` act on the
 * reported target and close the report; `dismiss` closes it with no action.
 * Each runs a server action (audit-logged API-side) in a transition.
 */
export function ReportActions({ id, targetType }: { id: string; targetType: 'review' | 'user' | 'product' }) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function resolve(action: 'hide' | 'delete' | 'dismiss' | 'ban', confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setErr(null);
    startTransition(async () => {
      try {
        await resolveReportAction(id, action);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Action failed');
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {targetType === 'review' && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => resolve('hide', 'Hide the reported review?')}>
            Hide content
          </Button>
        )}
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => resolve('delete', 'Delete the reported content?')}>
          Delete content
        </Button>
        {targetType === 'user' && (
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => resolve('ban', 'Ban the reported user?')}>
            Ban user
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={pending} onClick={() => resolve('dismiss')}>
          Dismiss
        </Button>
      </div>
      {pending && <p className="text-xs text-muted-foreground">Working…</p>}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
