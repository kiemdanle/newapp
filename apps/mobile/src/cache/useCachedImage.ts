import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSessionStore } from '../auth/session-store';
import {
  computeCacheKey,
  DEFAULT_PRIVATE_FRESH_TTL_MS,
  DEFAULT_PUBLIC_FRESH_TTL_MS,
  type CacheMetadata,
  type CacheOptions,
} from './image-cache-types';
import { imageDiskCache } from './image-disk-cache';
import { fetchAndCacheImage } from './image-revalidator';

export interface UseCachedImageResult {
  uri: string | null;
  isLoading: boolean;
  isRevalidating: boolean;
  error: Error | null;
  reload: () => Promise<void>;
}

export function useCachedImage(
  input: string | CacheOptions | null | undefined,
): UseCachedImageResult {
  // Normalize input into stable primitive fields
  const normalized = useMemo(() => {
    if (!input) return null;
    if (typeof input === 'string') {
      return { uri: input.trim(), isPrivate: false };
    }
    return {
      uri: input.uri ? input.uri.trim() : null,
      target: input.target,
      targetKey: input.target
        ? input.target.kind === 'draft'
          ? `draft:${input.target.productId}`
          : `edit:${input.target.editId}`
        : null,
      photoId: input.photoId,
      variant: input.variant,
      headers: input.headers,
      freshTtlMs: input.freshTtlMs,
      isPrivate: input.isPrivate,
      userId: input.userId,
    };
  }, [
    typeof input === 'string'
      ? input
      : input
        ? `${input.uri || ''}::${input.target?.kind || ''}::${
            input.target?.kind === 'draft'
              ? input.target.productId
              : input.target?.kind === 'product_edit'
                ? input.target.editId
                : ''
          }::${input.photoId || ''}::${input.variant || ''}::${input.freshTtlMs || ''}::${input.isPrivate || ''}::${input.userId || ''}::${JSON.stringify(input.headers || {})}`
        : null,
  ]);

  const userId = useSessionStore((s) => s.user?.id);
  const optionsRef = useRef<CacheOptions | null>(null);
  optionsRef.current = input
    ? typeof input === 'string'
      ? { uri: input }
      : input
    : null;

  const key = useMemo(() => {
    if (!normalized) return null;
    return computeCacheKey(normalized, userId);
  }, [normalized, userId]);

  // Synchronous L1 memory check
  const syncCached = key ? imageDiskCache.getSync(key) : null;
  const isSyncFresh = syncCached
    ? Date.now() - syncCached.timestamp <
      (normalized?.freshTtlMs ??
        (syncCached.isPrivate
          ? DEFAULT_PRIVATE_FRESH_TTL_MS
          : DEFAULT_PUBLIC_FRESH_TTL_MS))
    : false;

  const [state, setState] = useState<{
    key: string | null;
    uri: string | null;
    isLoading: boolean;
    isRevalidating: boolean;
    error: Error | null;
  }>(() => {
    if (!key || !normalized) {
      return { key: null, uri: null, isLoading: false, isRevalidating: false, error: null };
    }
    if (syncCached) {
      return {
        key,
        uri: syncCached.localUri || syncCached.uri,
        isLoading: false,
        isRevalidating: !isSyncFresh,
        error: null,
      };
    }
    return {
      key,
      uri: null,
      isLoading: true,
      isRevalidating: false,
      error: null,
    };
  });

  // Track key transitions to prevent state holdover when user switches or key changes
  const prevKeyRef = useRef<string | null>(key);
  if (prevKeyRef.current !== key) {
    prevKeyRef.current = key;
    if (!key || !normalized) {
      setState({ key: null, uri: null, isLoading: false, isRevalidating: false, error: null });
    } else if (syncCached) {
      setState({
        key,
        uri: syncCached.localUri || syncCached.uri,
        isLoading: false,
        isRevalidating: !isSyncFresh,
        error: null,
      });
    } else {
      setState({
        key,
        uri: null,
        isLoading: true,
        isRevalidating: false,
        error: null,
      });
    }
  }

  const performFetch = useCallback(
    async (cached: CacheMetadata | null) => {
      const currentOpts = optionsRef.current;
      if (!currentOpts || !key) return;

      try {
        const result = await fetchAndCacheImage(currentOpts, userId, cached);
        if (result) {
          const newUri = result.localUri || result.uri;
          setState((prev) => {
            if (prev.key !== key) {
              return prev; // Ignore stale result for previous key
            }
            if (
              prev.uri === newUri &&
              !prev.isLoading &&
              !prev.isRevalidating &&
              prev.error === null
            ) {
              return prev;
            }
            return {
              key,
              uri: newUri,
              isLoading: false,
              isRevalidating: false,
              error: null,
            };
          });
        } else {
          setState((prev) => {
            if (prev.key !== key) return prev;
            return {
              ...prev,
              key,
              uri: null,
              isLoading: false,
              isRevalidating: false,
            };
          });
        }
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error(String(err));
        const isAuthError =
          error.name === 'AuthorizationError' ||
          (error as { status?: number }).status === 401 ||
          (error as { status?: number }).status === 403;
        if (cached && !isAuthError) {
          const cachedUri = cached.localUri || cached.uri;
          setState((prev) => {
            if (prev.key !== key) return prev;
            if (
              prev.uri === cachedUri &&
              !prev.isLoading &&
              !prev.isRevalidating
            ) {
              return prev;
            }
            return {
              key,
              uri: cachedUri,
              isLoading: false,
              isRevalidating: false,
              error: null,
            };
          });
        } else {
          setState((prev) => {
            if (prev.key !== key) return prev;
            if (
              prev.uri === null &&
              !prev.isLoading &&
              !prev.isRevalidating &&
              prev.error === error
            ) {
              return prev;
            }
            return {
              key,
              uri: null,
              isLoading: false,
              isRevalidating: false,
              error,
            };
          });
        }
      }
    },
    [key, userId],
  );

  useEffect(() => {
    if (!key || !normalized) {
      setState((prev) => {
        if (prev.key === null && prev.uri === null && !prev.isLoading && !prev.isRevalidating && prev.error === null) {
          return prev;
        }
        return { key: null, uri: null, isLoading: false, isRevalidating: false, error: null };
      });
      return;
    }

    let isMounted = true;

    const runRevalidation = async () => {
      let cached = imageDiskCache.getSync(key);
      if (!cached) {
        cached = await imageDiskCache.get(key);
        if (!isMounted) return;
        if (cached) {
          const cachedUri = cached.localUri || cached.uri;
          setState((prev) => {
            if (prev.key !== key) return prev;
            if (prev.uri === cachedUri && !prev.isLoading) return prev;
            return {
              ...prev,
              key,
              uri: cachedUri,
              isLoading: false,
            };
          });
        }
      }

      const ttl =
        normalized.freshTtlMs ??
        (cached?.isPrivate
          ? DEFAULT_PRIVATE_FRESH_TTL_MS
          : DEFAULT_PUBLIC_FRESH_TTL_MS);

      const isFresh = cached ? Date.now() - cached.timestamp < ttl : false;

      if (cached && isFresh) {
        if (isMounted) {
          setState((prev) => {
            if (prev.key !== key) return prev;
            if (!prev.isRevalidating && !prev.isLoading) return prev;
            return {
              ...prev,
              key,
              isRevalidating: false,
              isLoading: false,
            };
          });
        }
        return;
      }

      if (isMounted) {
        setState((prev) => {
          if (prev.key !== key) return prev;
          const nextIsRevalidating = Boolean(cached);
          const nextIsLoading = !cached;
          if (
            prev.isRevalidating === nextIsRevalidating &&
            prev.isLoading === nextIsLoading
          ) {
            return prev;
          }
          return {
            ...prev,
            key,
            isRevalidating: nextIsRevalidating,
            isLoading: nextIsLoading,
          };
        });
      }

      if (isMounted) {
        await performFetch(cached);
      }
    };

    const unsubscribe = imageDiskCache.onPurge((filter) => {
      if (!isMounted || !key) return;
      if (filter === '*' || key.includes(filter)) {
        setState({
          key,
          uri: null,
          isLoading: false,
          isRevalidating: false,
          error: null,
        });
      }
    });

    void runRevalidation();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [key, normalized, performFetch]);

  const reload = useCallback(async () => {
    if (!key) return;
    const cached = imageDiskCache.getSync(key) || (await imageDiskCache.get(key));
    setState((prev) => ({ ...prev, key, isRevalidating: true }));
    await performFetch(cached);
  }, [key, performFetch]);

  return {
    uri: state.uri,
    isLoading: state.isLoading,
    isRevalidating: state.isRevalidating,
    error: state.error,
    reload,
  };
}
