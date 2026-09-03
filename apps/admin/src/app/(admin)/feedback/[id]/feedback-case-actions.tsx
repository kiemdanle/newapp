'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { updateFeedbackStatusAction } from '@/lib/actions';
import { CheckCircle2, XCircle, RotateCcw, Clock } from 'lucide-react';
import type { FeedbackStatus } from '@expyrico/shared';

export function FeedbackCaseActions({
  ticketId,
  currentStatus,
}: {
  ticketId: string;
  currentStatus: FeedbackStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  function handleStatusChange(
    newStatus: 'open' | 'in_progress' | 'replied' | 'resolved' | 'closed',
    notes?: string,
  ) {
    setError(null);
    startTransition(async () => {
      try {
        await updateFeedbackStatusAction(ticketId, newStatus, notes);
        setShowResolveModal(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update status');
      }
    });
  }

  const isClosed = currentStatus === 'closed' || currentStatus === 'resolved';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {currentStatus === 'open' && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => handleStatusChange('in_progress')}
            className="gap-1.5 rounded-xl border-neutral-300"
          >
            <Clock size={13} className="text-amber-600" />
            <span>Mark In Progress</span>
          </Button>
        )}

        {!isClosed && (
          <>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => setShowResolveModal(true)}
              className="gap-1.5 rounded-xl bg-primary text-white hover:bg-primary-dark"
            >
              <CheckCircle2 size={13} />
              <span>Resolve Case</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => handleStatusChange('closed', 'Closed by administrator')}
              className="gap-1.5 rounded-xl border-neutral-300 text-neutral-mid hover:text-neutral-dark"
            >
              <XCircle size={13} />
              <span>Close Case</span>
            </Button>
          </>
        )}

        {isClosed && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => handleStatusChange('in_progress')}
            className="gap-1.5 rounded-xl border-neutral-300"
          >
            <RotateCcw size={13} />
            <span>Reopen Case</span>
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-destructive font-medium">{error}</p>}

      {/* Resolution Notes Modal / Form */}
      {showResolveModal && (
        <div className="rounded-2xl border border-primary/30 bg-primary-light/10 p-4 space-y-3 animate-fade-in">
          <h4 className="text-xs font-bold text-neutral-dark uppercase tracking-wider">
            Resolve Case Details
          </h4>
          <textarea
            rows={2}
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="Explain how this issue was resolved (e.g. deployed bug fix, added setting, clarified workflow)..."
            className="w-full rounded-xl border border-neutral-300 bg-white p-2.5 text-xs text-neutral-dark placeholder:text-neutral-mid/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 resize-none shadow-xs"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setShowResolveModal(false)}
              className="rounded-lg h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => handleStatusChange('resolved', resolutionNotes)}
              className="rounded-lg h-8 text-xs bg-primary text-white"
            >
              Confirm Resolution
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
