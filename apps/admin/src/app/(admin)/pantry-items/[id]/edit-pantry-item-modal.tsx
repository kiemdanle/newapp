'use client';

import { useState, useTransition } from 'react';
import type { AdminPantryItemDetail, RecordStatus } from '@expyrico/shared';
import { Button } from '@/components/ui/button';
import { patchPantryItemAction } from '@/lib/actions';
import { Edit3, AlertCircle, X } from 'lucide-react';

interface EditPantryItemModalProps {
  item: AdminPantryItemDetail;
  onClose: () => void;
}

const LOCATION_PRESETS = ['Fridge', 'Freezer', 'Pantry', 'Cabinet', 'Counter'];

export function EditPantryItemModal({ item, onClose }: EditPantryItemModalProps) {
  const [customName, setCustomName] = useState(item.customName ?? '');
  const [brand, setBrand] = useState(item.brand ?? '');
  const [category, setCategory] = useState(item.category ?? '');
  const [location, setLocation] = useState(item.location ?? '');
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unit, setUnit] = useState(item.unit);
  const [expiryDate, setExpiryDate] = useState(item.expiryDate);
  const [purchaseDate, setPurchaseDate] = useState(item.purchaseDate ?? '');
  const [price, setPrice] = useState(item.price !== null ? String(item.price) : '');
  const [store, setStore] = useState(item.store ?? '');
  const [notes, setNotes] = useState(item.notes ?? '');
  const [status, setStatus] = useState<RecordStatus>(item.status);
  const [discardReason, setDiscardReason] = useState(item.discardReason ?? '');

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numQuantity = Number(quantity);
    if (isNaN(numQuantity) || numQuantity < 0) {
      setError('Quantity must be a non-negative number.');
      return;
    }

    const payload = {
      customName: customName.trim() || null,
      brand: brand.trim() || null,
      category: category.trim() || null,
      location: location.trim() || null,
      quantity: numQuantity,
      unit: unit.trim() || 'pcs',
      expiryDate,
      purchaseDate: purchaseDate.trim() || null,
      price: price.trim() ? Number(price) : null,
      store: store.trim() || null,
      notes: notes.trim() || null,
      status,
      discardReason: status === 'discarded' ? discardReason.trim() || null : null,
    };

    startTransition(async () => {
      const res = await patchPantryItemAction(item.id, payload);
      if (res.ok) {
        onClose();
      } else {
        setError(res.detail ?? 'Failed to update pantry item.');
      }
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 my-8">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-light/60 text-primary-dark">
              <Edit3 size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-dark font-display">
                Edit Pantry Item
              </h3>
              <p className="text-xs text-neutral-mid truncate max-w-[340px]">
                {item.displayName}
              </p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Custom Name */}
          <div className="space-y-1">
            <label className="font-semibold text-neutral-dark uppercase tracking-wide text-[11px]">
              Item Name (Custom Override)
            </label>
            <input
              type="text"
              maxLength={120}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Fresh Greek Yogurt"
              className="h-9 w-full rounded-xl border border-neutral-300 bg-white px-3 text-xs font-normal text-neutral-dark outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 shadow-xs transition"
            />
          </div>

          {/* Brand & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-neutral-dark uppercase tracking-wide text-[11px]">
                Brand
              </label>
              <input
                type="text"
                maxLength={120}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Chobani"
                className="h-9 w-full rounded-xl border border-neutral-300 bg-white px-3 text-xs font-normal text-neutral-dark outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 shadow-xs transition"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-neutral-dark uppercase tracking-wide text-[11px]">
                Category
              </label>
              <input
                type="text"
                maxLength={60}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Dairy"
                className="h-9 w-full rounded-xl border border-neutral-300 bg-white px-3 text-xs font-normal text-neutral-dark outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 shadow-xs transition"
              />
            </div>
          </div>

          {/* Location with quick pills */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-neutral-dark uppercase tracking-wide text-[11px]">
                Storage Location
              </label>
              <div className="flex items-center gap-1">
                {LOCATION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setLocation(preset)}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-200 bg-neutral-50 hover:bg-primary-light/20 hover:text-primary transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              maxLength={50}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Fridge Top Shelf"
              className="h-9 w-full rounded-xl border border-neutral-300 bg-white px-3 text-xs font-normal text-neutral-dark outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 shadow-xs transition"
            />
          </div>

          {/* Quantity and Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-neutral-dark uppercase tracking-wide text-[11px]">
                Quantity
              </label>
              <input
                type="number"
                step="any"
                min="0"
                max="100000"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-9 w-full rounded-xl border border-neutral-300 bg-white px-3 text-xs font-normal text-neutral-dark outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 shadow-xs transition font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-neutral-dark uppercase tracking-wide text-[11px]">
                Unit
              </label>
              <input
                type="text"
                maxLength={16}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="h-9 w-full rounded-xl border border-neutral-300 bg-white px-3 text-xs font-normal text-neutral-dark outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 shadow-xs transition"
              />
            </div>
          </div>

          {/* Dates: Expiry and Purchase */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-neutral-dark uppercase tracking-wide text-[11px]">
                Expiry Date
              </label>
              <input
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="h-9 w-full rounded-xl border border-neutral-300 bg-white px-3 text-xs font-normal text-neutral-dark outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 shadow-xs transition font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-neutral-dark uppercase tracking-wide text-[11px]">
                Purchase Date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="h-9 w-full rounded-xl border border-neutral-300 bg-white px-3 text-xs font-normal text-neutral-dark outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 shadow-xs transition font-mono"
              />
            </div>
          </div>

          {/* Price and Store */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-neutral-dark uppercase tracking-wide text-[11px]">
                Price
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 4.99"
                className="h-9 w-full rounded-xl border border-neutral-300 bg-white px-3 text-xs font-normal text-neutral-dark outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 shadow-xs transition font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-neutral-dark uppercase tracking-wide text-[11px]">
                Store Name
              </label>
              <input
                type="text"
                maxLength={120}
                value={store}
                onChange={(e) => setStore(e.target.value)}
                placeholder="e.g. Trader Joe's"
                className="h-9 w-full rounded-xl border border-neutral-300 bg-white px-3 text-xs font-normal text-neutral-dark outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 shadow-xs transition"
              />
            </div>
          </div>

          {/* Status & Discard Reason */}
          <div className="space-y-3 p-3 rounded-xl bg-neutral-50 border border-neutral-200">
            <div className="space-y-1">
              <label className="font-semibold text-neutral-dark uppercase tracking-wide text-[11px]">
                Item Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as RecordStatus)}
                className="h-9 w-full rounded-xl border border-neutral-300 bg-white px-3 text-xs font-normal text-neutral-dark outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 shadow-xs transition"
              >
                <option value="active">Active</option>
                <option value="consumed">Consumed</option>
                <option value="discarded">Discarded</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            {status === 'discarded' && (
              <div className="space-y-1">
                <label className="font-semibold text-neutral-dark uppercase tracking-wide text-[11px]">
                  Discard Reason
                </label>
                <input
                  type="text"
                  maxLength={50}
                  value={discardReason}
                  onChange={(e) => setDiscardReason(e.target.value)}
                  placeholder="e.g. Expired, spoiled, damaged"
                  className="h-9 w-full rounded-xl border border-neutral-300 bg-white px-3 text-xs font-normal text-neutral-dark outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 shadow-xs transition"
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="font-semibold text-neutral-dark uppercase tracking-wide text-[11px]">
              Notes
            </label>
            <textarea
              rows={3}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional administrator or user notes..."
              className="w-full rounded-xl border border-neutral-300 bg-white p-3 text-xs font-normal text-neutral-dark outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 shadow-xs transition"
            />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
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
              type="submit"
              variant="default"
              size="sm"
              disabled={pending}
              className="h-9 px-5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-dark text-white shadow-xs"
            >
              {pending ? 'Saving Changes...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
