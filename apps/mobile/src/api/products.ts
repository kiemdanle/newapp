import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import type {
  Product,
  ProductDraftsPage,
  ProductDraftStatus,
  ProductLookupV2Response,
  ProductSearchResult,
  ProductWithReviews,
} from '@expyrico/shared';
import { apiClient } from './client';
import { uploadProductPhoto, deleteProductPhoto, reorderProductPhotos } from './product-photo-upload';
import type { CoordinatorAdapter } from '../features/products/draft-mutation-coordinator';

/** Conclusive-outcome lookup: `found | editable_private | creator_pending |
 * under_review | not_found | temporarily_unavailable`. A thrown network/5xx
 * error is a SEPARATE failure mode from the `temporarily_unavailable`
 * outcome (still a 200) — callers must treat both the same way (retry, never
 * route to creation) but cannot conflate them with a schema-valid response. */
export function useProductLookupV2() {
  return useMutation({
    mutationFn: async (input: { barcode?: string; qr?: string }) => {
      return await apiClient.post<ProductLookupV2Response>('/products/lookup-v2', input);
    },
  });
}

export function useProductSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: ['products', 'search', q],
    enabled: enabled && q.length > 0,
    queryFn: async () => {
      const data = await apiClient.get<ProductSearchResult>(
        `/products/search?q=${encodeURIComponent(q)}`,
      );
      return data.items;
    },
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['products', id],
    enabled: Boolean(id),
    queryFn: async () => {
      return await apiClient.get<ProductWithReviews>(`/products/${id}`);
    },
  });
}

/** Create-or-resume: idempotent by (caller, identifier) on the server, so
 * calling this again for an identifier the creator already has a draft for
 * returns that same draft (`resumed: true`) rather than a duplicate. This is
 * the entry point for both a fresh "Create" from a conclusive miss and a
 * `editable_private`/`creator_pending` scan resume. */
export function useCreateOrResumeDraft() {
  return useMutation({
    mutationFn: async (input: { barcode?: string | null; qrPayload?: string | null }) => {
      return await apiClient.post<{ product: Product; resumed: boolean }>('/products/drafts', input);
    },
  });
}

export function usePatchDraft() {
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      name?: string;
      description?: string | null;
      brand?: string | null;
      category?: string | null;
    }) => {
      const { id, ...body } = input;
      return await apiClient.patch<Product>(`/products/drafts/${id}`, body);
    },
  });
}

export function useProductDrafts(status?: ProductDraftStatus) {
  return useInfiniteQuery<ProductDraftsPage>({
    queryKey: ['products', 'drafts', status ?? 'all'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const statusQs = status ? `status=${status}` : '';
      const cursorQs = pageParam ? `cursor=${pageParam}` : '';
      const qs = [statusQs, cursorQs].filter(Boolean).join('&');
      return apiClient.get<ProductDraftsPage>(`/products/drafts${qs ? `?${qs}` : ''}`);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** Wires the generic mutation coordinator (Task 5) to a specific draft's
 * routes. The coordinator itself never imports `Product` or this module —
 * this is the one place that binds the two together, so Task 8's active-
 * revision editor can supply its own adapter against `/product-edits/:id/*`
 * without this module knowing about `ProductEditRow` at all. */
export function createProductDraftCoordinatorAdapter(productId: string): CoordinatorAdapter<Product> {
  const target = { kind: 'draft' as const, productId };
  return {
    patchMetadata: (id, version, fields) => apiClient.patch<Product>(`/products/drafts/${id}`, { version, ...fields }),
    // No separate "refresh" endpoint exists for a draft — the plain product
    // GET is authoritative for both draft and active rows.
    refetch: (id) => apiClient.get<Product>(`/products/${id}`),
    uploadPhoto: (photo) => uploadProductPhoto(target, photo),
    deletePhoto: (photoId) => deleteProductPhoto(target, photoId),
    orderPhotos: (photoIds) => reorderProductPhotos(target, photoIds),
  };
}

export interface SubmitDraftInput {
  id: string;
  version: number;
  abuseToken: string;
  platform: 'android' | 'ios';
  /** Stable across a `temporarily_unavailable` (503) retry of the exact same
   * submit attempt; a fresh key is required for any other retry (the
   * server's idempotency plugin only releases its reservation on a 5xx —
   * replaying the same key with a different body after a 2xx/4xx outcome is
   * rejected as `idempotency_key_reused`). See DraftSubmitPanel. */
  idempotencyKey: string;
}

export function useSubmitDraft() {
  return useMutation({
    mutationFn: async (input: SubmitDraftInput) => {
      const { id, idempotencyKey, ...body } = input;
      return await apiClient.post<Product>(`/products/drafts/${id}/submit`, body, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
    },
  });
}
