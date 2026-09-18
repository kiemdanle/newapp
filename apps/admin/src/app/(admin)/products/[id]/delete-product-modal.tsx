'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { deleteProductAction, patchProductAction } from '@/lib/actions';
import { Trash2, AlertTriangle, AlertCircle, X, GitMerge, EyeOff, Loader2 } from 'lucide-react';

export interface DeleteProductModalProps {
  product: {
    id: string;
    name: string;
    pantryItemCount: number;
    status: string;
    barcode?: string | null | undefined;
    version: number;
  };
  onClose: () => void;
  redirectToIndex?: boolean | undefined;
}

export function DeleteProductModal({
  product,
  onClose,
  redirectToIndex = false,
}: DeleteProductModalProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pantryCount, setPantryCount] = useState(product.pantryItemCount);
  const [currentStatus, setCurrentStatus] = useState(product.status);
  const [pending, startTransition] = useTransition();
  const [hiding, startHidingTransition] = useTransition();

  const isInUse = pantryCount > 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteProductAction(product.id, product.version);
      if (res.ok) {
        onClose();
        if (redirectToIndex) {
          router.push('/products');
        }
      } else {
        if (res.code === 'product_has_pantry_items') {
          // Dynamic switch to in-use merge prompt if pantry records were added concurrently
          setPantryCount(1);
          setError(res.detail ?? 'This product is in use by stash items and cannot be deleted.');
        } else if (res.code === 'version_conflict') {
          setError('This product was modified by another administrator. Please refresh the page.');
        } else {
          setError(res.detail ?? 'Failed to delete product.');
        }
      }
    });
  };

  const handleHideFromSearch = () => {
    setError(null);
    startHidingTransition(async () => {
      const res = await patchProductAction(product.id, product.version, { status: 'report_hidden' });
      if (res.ok) {
        setCurrentStatus('report_hidden');
      } else {
        setError(res.detail ?? 'Failed to hide product from search.');
      }
    });
  };

  const handleGoToMerge = () => {
    onClose();
    router.push(`/products/${product.id}/merge?direction=into`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
    >
      <div
        className={`relative w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-4 ${
          isInUse ? 'border-amber-200' : 'border-red-200'
        }`}
      >
        {/* Close icon */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {isInUse ? (
          /* --- IN-USE STATE: Blocked with Merge CTA --- */
          <>
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[#F5A623] shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 pr-6">
                <h2 className="text-base font-semibold text-foreground">
                  Cannot Delete Product in Use
                </h2>
                <p className="text-xs text-muted-foreground">
                  Catalog product &ldquo;{product.name}&rdquo; is actively referenced.
                </p>
              </div>
            </div>

            {/* Explanation & Guidance */}
            <div className="rounded-xl bg-amber-50/70 border border-amber-200/70 p-3.5 space-y-2 text-xs text-amber-950 leading-relaxed">
              <p>
                This product is currently used by <strong>{pantryCount}</strong> stash item(s).
                Deleting it directly would break or orphan user stash records.
              </p>
              <p className="text-amber-900/90">
                <strong>Recommended action:</strong> Use the Merge tool to consolidate this product into
                another canonical product. All stash items, reviews, and deals will be safely moved.
              </p>
            </div>

            {/* Containment note */}
            {currentStatus === 'active' && (
              <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 text-xs text-stone-700 space-y-2">
                <p>
                  <strong>Immediate containment:</strong> If this product should not be added to any new
                  pantries, you can hide it from search now while arranging the merge.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleHideFromSearch}
                  disabled={hiding}
                  className="w-full text-xs font-medium flex items-center justify-center gap-1.5 border-stone-300 hover:bg-stone-100"
                >
                  {hiding ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-stone-600" />
                  )}
                  Hide product from search
                </Button>
              </div>
            )}

            {currentStatus === 'report_hidden' && (
              <div className="rounded-xl bg-blue-50/80 border border-blue-200 p-2.5 text-xs text-blue-800 flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-blue-600 shrink-0" />
                <span>This product is currently hidden from search. New pantries cannot discover it.</span>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
                Close
              </Button>
              <Button
                size="sm"
                onClick={handleGoToMerge}
                className="text-xs font-semibold bg-[#4BAE8A] hover:bg-[#3A8F6F] text-white flex items-center gap-1.5"
              >
                <GitMerge className="w-3.5 h-3.5" />
                Merge into another product
              </Button>
            </div>
          </>
        ) : (
          /* --- UNUSED STATE: Direct Deletion Confirmation --- */
          <>
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-[#E0442A] shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 pr-6">
                <h2 className="text-base font-semibold text-foreground">
                  Delete Catalog Product
                </h2>
                <p className="text-xs text-muted-foreground">
                  Permanent deletion of &ldquo;{product.name}&rdquo;
                </p>
              </div>
            </div>

            {/* Warning text */}
            <div className="rounded-xl bg-red-50/70 border border-red-200/60 p-3.5 space-y-2 text-xs text-red-900 leading-relaxed">
              <p>
                Are you sure you want to permanently delete <strong>{product.name}</strong>?
              </p>
              <p className="text-red-800/90">
                No stash items are currently using this product. Deleting it will permanently remove it
                from the catalog, detach referencing giveaways, clean up stored photos, and release its
                barcode/identifiers.
              </p>
              <p className="font-semibold text-red-700">
                This action is irreversible and cannot be undone.
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={pending}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDelete}
                disabled={pending}
                className="text-xs font-semibold bg-[#E0442A] hover:bg-[#E0442A]/90 text-white flex items-center gap-1.5"
              >
                {pending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Product
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
export function DeleteProductButton({
  product,
  variant = 'outline',
  className,
  redirectToIndex = false,
}: {
  product: DeleteProductModalProps['product'];
  variant?: 'outline' | 'destructive' | 'ghost' | 'default' | undefined;
  className?: string | undefined;
  redirectToIndex?: boolean | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={variant}
        onClick={() => setOpen(true)}
        className={className}
      >
        <Trash2 className="w-4 h-4" />
        <span>Delete product</span>
      </Button>
      {open && (
        <DeleteProductModal
          product={product}
          onClose={() => setOpen(false)}
          redirectToIndex={redirectToIndex}
        />
      )}
    </>
  );
}

export function DeleteProductTableRowAction({
  product,
}: {
  product: DeleteProductModalProps['product'];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-[#E0442A] hover:underline"
      >
        Delete
      </button>
      {open && (
        <DeleteProductModal
          product={product}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
