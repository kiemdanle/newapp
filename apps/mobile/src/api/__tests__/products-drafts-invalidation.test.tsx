import { renderHook, act } from '@testing-library/react-native';
import React from 'react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import {
  useCreateOrResumeDraft,
  usePatchDraft,
  useSubmitDraft,
  createProductDraftCoordinatorAdapter,
} from '../products';
import { queueFetch, jsonResponse } from '../../../tests/mocks/fetch';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

describe('products drafts cache invalidation', () => {
  it('useCreateOrResumeDraft invalidates [products, drafts] on success', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCreateOrResumeDraft(), { wrapper });

    queueFetch(jsonResponse({ product: { id: 'p-1', version: 1 }, resumed: false }));

    await act(async () => {
      await result.current.mutateAsync({ barcode: '123456789012' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products', 'drafts'] });
  });

  it('usePatchDraft invalidates [products, drafts] and [products, id] on success', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => usePatchDraft(), { wrapper });

    queueFetch(jsonResponse({ id: 'p-1', version: 2, name: 'Patched' }));

    await act(async () => {
      await result.current.mutateAsync({ id: 'p-1', version: 1, name: 'Patched' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products', 'drafts'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products', 'p-1'] });
  });

  it('useSubmitDraft invalidates [products, drafts], [products, id], and [products] on success', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSubmitDraft(), { wrapper });

    queueFetch(jsonResponse({ id: 'p-1', version: 2, status: 'pending' }));

    await act(async () => {
      await result.current.mutateAsync({
        id: 'p-1',
        version: 1,
        abuseToken: 'tok',
        platform: 'android',
        idempotencyKey: 'idem-1',
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products', 'drafts'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products', 'p-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products'] });
  });

  it('createProductDraftCoordinatorAdapter invalidates queries on patchMetadata', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const adapter = createProductDraftCoordinatorAdapter('p-1', queryClient);

    queueFetch(jsonResponse({ id: 'p-1', version: 2, name: 'Coordinator Patched' }));

    await adapter.patchMetadata('p-1', 1, { name: 'Coordinator Patched' });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products', 'drafts'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products', 'p-1'] });
  });
});
