'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminPantryItemRow } from '@expyrico/shared';
import { Button } from '@/components/ui/button';
import { deletePantryItemAction } from '@/lib/actions';
import { Trash2, AlertTriangle, AlertCircle, X } from 'lucide-react';

interface DeletePantryItemModalProps {
  item: AdminPantryItemRow | { id: string; displayName: string; userEmail: string };
  onClose: () => void;
  redirectToIndex?: boolean;
}

export function DeletePantryItemModal({
  item,
  onClose,
  redirectToIndex = false,
}: DeletePantryItemModalProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const res = await deletePantryItemAction(item.id);
      if (res.ok) {
        onClose();
        if (redirectToIndex) {
          router.push('/pantry-items');
        }
      } else {
        setError(res.detail ?? 'Failed to delete pantry item.');
      }
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-red-200 bg-card p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 text-red-700">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 border border-red-200 text-red-600">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-dark">Permanently Delete Item</h3>
              <p className="text-xs text-neutral-mid truncate max-w-[280px]">{item.displayName}</p>
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

        {/* Warning text */}
        <div className="rounded-xl bg-red-50/70 border border-red-200/60 p-3 space-y-1.5 text-xs text-red-900 leading-relaxed">
          <p className="font-semibold text-red-700">Warning: This action is permanent.</p>
          <p>
            This will permanently remove the record for user <strong className="font-semibold">{item.userEmail}</strong>, cancel all upcoming push reminders, detach any linked giveaways, and create a deletion tombstone preventing accidental sync resurrection.
          </p>
        </div>

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
            onClick={handleDelete}
            disabled={pending}
            className="h-9 px-4 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white gap-1.5"
          >
            <Trash2 size={14} />
            <span>{pending ? 'Deleting...' : 'Delete Permanently'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
