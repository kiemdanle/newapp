import { useMutation } from '@tanstack/react-query';
import type { ProductEditRow } from '@expyrico/shared';
import { apiClient } from './client';
import { uploadProductPhoto, deleteProductPhoto, reorderProductPhotos } from './product-photo-upload';
import type { CoordinatorAdapter } from '../features/products/draft-mutation-coordinator';
import { newIdempotencyKey } from '../lib/idempotency';

/** Create-or-resume a creator's open revision for an active product. Also
 * doubles as the coordinator's `refetch()` — there is no separate `GET
 * /product-edits/:editId` route; calling this again for the same product
 * returns the caller's own still-open edit with its current state. Always
 * idempotent (the route requires an `Idempotency-Key`); a fresh key per call
 * is safe here since this never carries caller-supplied fields that could
 * collide with a stale cached response under a reused key. */
export function useCreateOrResumeEdit() {
  return useMutation({
    mutationFn: async (productId: string) => {
      return await apiClient.post<ProductEditRow>(`/products/${productId}/edit`, undefined, {
        headers: { 'Idempotency-Key': newIdempotencyKey() },
      });
    },
  });
}

/** Wires the Task 5 mutation coordinator to one open revision's routes —
 * mirrors `createProductDraftCoordinatorAdapter` in `products.ts`, the only
 * difference being the edit-scoped route shapes and the `refetch` above.
 * `productId` (not just `editId`) is required because the only "refresh"
 * primitive is keyed by product, not edit. */
export function createProductEditCoordinatorAdapter(productId: string, editId: string): CoordinatorAdapter<ProductEditRow> {
  const target = { kind: 'product_edit' as const, editId };
  return {
    patchMetadata: (id, version, fields) => apiClient.patch<ProductEditRow>(`/product-edits/${id}`, { version, ...fields }),
    refetch: () =>
      apiClient.post<ProductEditRow>(`/products/${productId}/edit`, undefined, {
        headers: { 'Idempotency-Key': newIdempotencyKey() },
      }),
    uploadPhoto: (photo) => uploadProductPhoto<ProductEditRow>(target, photo),
    deletePhoto: (photoId) => deleteProductPhoto<ProductEditRow>(target, photoId),
    orderPhotos: (photoIds) => reorderProductPhotos<ProductEditRow>(target, photoIds),
  };
}

export interface SubmitEditInput {
  id: string;
  version: number;
  idempotencyKey: string;
}

/** Unlike a draft submit, an edit submit carries no abuse token — active
 * revisions aren't gated by `product_creation` (plan.md). A `409
 * edit_base_stale` (the live product changed since this revision was based
 * on it) is a distinct, non-retryable-by-the-creator outcome from the usual
 * `409 version_conflict` — only an admin can rebase/supersede it; see
 * EditSubmitPanel. */
export function useSubmitEdit() {
  return useMutation({
    mutationFn: async (input: SubmitEditInput) => {
      const { id, idempotencyKey, version } = input;
      return await apiClient.post<ProductEditRow>(
        `/product-edits/${id}/submit`,
        { version },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      );
    },
  });
}
