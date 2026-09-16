'use client';

import { useState, useTransition } from 'react';
import type { AdminPantryItemRow } from '@expyrico/shared';
import { Button } from '@/components/ui/button';
import { discardPantryItemAction } from '@/lib/actions';
import { Archive, AlertCircle, X } from 'lucide-react';

interface DiscardPantryItemModalProps {
  item: AdminPantryItemRow | { id: string; displayName: string; userEmail: string };
  onClose: () => void;
}

export function DiscardPantryItemModal({
  item,
  onClose,
}: DiscardPantryItemModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleDiscard = () => {
    setError(null);
    startTransition(async () => {
      const res = await discardPantryItemAction(item.id, reason.trim() || undefined);
      if (res.ok) {
        onClose();
      } else {
        setError(res.detail ?? 'Failed to mark item as discarded.');
      }
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 text-amber-800">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 border border-amber-200">
              <Archive size={18} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-dark">Mark as Discarded</h3>
              <p className="text-xs text-neutral-mid">{item.displayName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Message */}
        <p className="text-xs text-neutral-dark leading-relaxed">
          This will move the item to the user&apos;s Discarded archive and cancel any upcoming expiry reminders. The user can still restore or view it with undo on mobile.
        </p>

        {/* Optional Discard Reason */}
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-mid">
          <span>Discard Reason (Optional)</span>
          <input
            type="text"
            maxLength={50}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Expired, spoiled, opened and unused"
            className="h-10 rounded-xl border border-neutral-300 bg-white px-3.5 text-sm font-normal text-neutral-dark placeholder:text-neutral-mid/50 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/15 shadow-xs"
          />
          <span className="text-[10px] text-neutral-400 text-right">{reason.length}/50</span>
        </label>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={pending}
            className="h-9 px-4 rounded-xl text-xs font-medium"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleDiscard}
            disabled={pending}
            className="h-9 px-4 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
          >
            {pending ? 'Discarding...' : 'Confirm Discard'}
          </Button>
        </div>
      </div>
    </div>
  );
}
