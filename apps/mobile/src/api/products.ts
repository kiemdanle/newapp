import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  Product,
  ProductLookupResponse,
  ProductSearchResult,
  ProductWithReviews,
} from '@expyrico/shared';
import { apiClient } from './client';

export function useProductLookup() {
  return useMutation({
    mutationFn: async (input: { barcode?: string; qr?: string }) => {
      const data = await apiClient.post<ProductLookupResponse>('/products/lookup', input);
      return data.product;
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
