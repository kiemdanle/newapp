'use client';

import { useState } from 'react';
import type { AdminPantryItemDetail } from '@expyrico/shared';
import { Button } from '@/components/ui/button';
import { Edit2, Archive, Trash2 } from 'lucide-react';
import { EditPantryItemModal } from './edit-pantry-item-modal';
import { DiscardPantryItemModal } from '../discard-pantry-item-modal';
import { DeletePantryItemModal } from '../delete-pantry-item-modal';

export function PantryItemDetailActions({
  item,
  initialEditOpen = false,
}: {
  item: AdminPantryItemDetail;
  initialEditOpen?: boolean;
}) {
  const [editOpen, setEditOpen] = useState(initialEditOpen);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Edit Button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditOpen(true)}
          className="h-9 px-3.5 rounded-xl border-neutral-300 text-xs font-semibold text-neutral-dark hover:border-primary hover:text-primary gap-1.5 shadow-xs"
        >
          <Edit2 size={14} />
          <span>Edit Item</span>
        </Button>

        {/* Discard Button (if not already discarded) */}
        {item.status !== 'discarded' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDiscardOpen(true)}
            className="h-9 px-3.5 rounded-xl border-amber-200 text-xs font-semibold text-amber-800 hover:bg-amber-50 hover:border-amber-300 gap-1.5 shadow-xs"
          >
            <Archive size={14} className="text-amber-600" />
            <span>Mark as Discarded</span>
          </Button>
        )}

        {/* Delete Button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDeleteOpen(true)}
          className="h-9 px-3.5 rounded-xl border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50 hover:border-red-300 gap-1.5 shadow-xs"
        >
          <Trash2 size={14} className="text-red-600" />
          <span>Permanently Delete</span>
        </Button>
      </div>

      {/* Modals */}
      {editOpen && (
        <EditPantryItemModal item={item} onClose={() => setEditOpen(false)} />
      )}

      {discardOpen && (
        <DiscardPantryItemModal item={item} onClose={() => setDiscardOpen(false)} />
      )}

      {deleteOpen && (
        <DeletePantryItemModal
          item={item}
          onClose={() => setDeleteOpen(false)}
          redirectToIndex={true}
        />
      )}
    </>
  );
}
