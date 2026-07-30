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
