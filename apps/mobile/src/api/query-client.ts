import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './errors';

let _queryClient: QueryClient | undefined;

export function createQueryClient(): QueryClient {
  _queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, err) => {
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  return _queryClient;
}

export function clearQueryClient(): void {
  if (_queryClient) {
    _queryClient.clear();
  }
}
