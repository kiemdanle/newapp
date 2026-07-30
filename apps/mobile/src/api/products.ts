import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  Product,
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

export function useCreateProduct() {
  return useMutation({
    mutationFn: async (input: {
      barcode?: string | null;
      qrPayload?: string | null;
      name: string;
      brand?: string | null;
      defaultShelfLifeDays?: number | null;
    }) => {
      return await apiClient.post<Product>('/products', input);
    },
  });
}
