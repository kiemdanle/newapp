// apps/mobile/src/features/records/usePantryPagination.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface UsePantryPaginationResult<T> {
  paginatedItems: T[];
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  reset: () => void;
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export function usePantryPagination<T>(
  items: T[],
  pageSize: number = 20,
  resetKey?: string,
): UsePantryPaginationResult<T> {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  const inFlightRef = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const totalCount = items.length;
  const hasMore = currentPage * pageSize < totalCount;

  // Derive slice directly from currentPage and items
  const paginatedItems = useMemo(() => {
    return items.slice(0, currentPage * pageSize);
  }, [items, currentPage, pageSize]);

  const reset = useCallback(() => {
    setCurrentPage(1);
    setIsLoadingMore(false);
    inFlightRef.current = false;
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
  }, []);

  // Stable reset effect: when resetKey changes (query, filters, scope, sort),
  // reset pagination to page 1 and clear any in-flight operations.
  useEffect(() => {
    reset();
  }, [resetKey, reset]);

  // Three-stage loading lifecycle:
  // 1. Guard against concurrent in-flight calls or exhaustion.
  // 2. Set loading state to render the spinner.
  // 3. Defer slice increment by 180ms across visual frames for tangible feedback.
  const loadMore = useCallback(() => {
    if (inFlightRef.current || !hasMore) {
      return;
    }
    inFlightRef.current = true;
    setIsLoadingMore(true);

    timerRef.current = setTimeout(() => {
      setCurrentPage((prev) => prev + 1);
      setIsLoadingMore(false);
      inFlightRef.current = false;
      timerRef.current = undefined;
    }, 180);
  }, [hasMore]);

  // Unmount cleanup to prevent memory leaks or setState on unmounted component
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      inFlightRef.current = false;
    };
  }, []);

  return {
    paginatedItems,
    hasMore,
    isLoadingMore,
    loadMore,
    reset,
    totalCount,
    currentPage,
    pageSize,
  };
}
