// apps/mobile/tests/unit/use-pantry-pagination.test.ts
import { renderHook, act } from '@testing-library/react-native';
import { usePantryPagination } from '../../src/features/records/usePantryPagination';

describe('usePantryPagination', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const sampleItems = Array.from({ length: 45 }, (_, i) => ({
    id: `item-${i + 1}`,
    name: `Grocery Item ${i + 1}`,
  }));

  it('initializes with page 1 and slices items to pageSize', () => {
    const { result } = renderHook(() =>
      usePantryPagination(sampleItems, 20, 'default-key'),
    );

    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(20);
    expect(result.current.totalCount).toBe(45);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.isLoadingMore).toBe(false);
    expect(result.current.paginatedItems.length).toBe(20);
    expect(result.current.paginatedItems[0]?.id).toBe('item-1');
    expect(result.current.paginatedItems[19]?.id).toBe('item-20');
  });

  it('loads more items across intentional delay and appends to derived slice', () => {
    const { result } = renderHook(() =>
      usePantryPagination(sampleItems, 20, 'default-key'),
    );

    act(() => {
      result.current.loadMore();
    });

    // Loading indicator activates immediately
    expect(result.current.isLoadingMore).toBe(true);
    // Derived slice still page 1 prior to timer tick
    expect(result.current.paginatedItems.length).toBe(20);

    // Advance 180ms delay
    act(() => {
      jest.advanceTimersByTime(180);
    });

    expect(result.current.isLoadingMore).toBe(false);
    expect(result.current.currentPage).toBe(2);
    expect(result.current.paginatedItems.length).toBe(40);
    expect(result.current.hasMore).toBe(true);

    // Load final page
    act(() => {
      result.current.loadMore();
    });
    act(() => {
      jest.advanceTimersByTime(180);
    });

    expect(result.current.currentPage).toBe(3);
    expect(result.current.paginatedItems.length).toBe(45);
    expect(result.current.hasMore).toBe(false);

    // Calling loadMore when !hasMore is a no-op
    act(() => {
      result.current.loadMore();
    });
    expect(result.current.isLoadingMore).toBe(false);
  });

  it('guards against concurrent loadMore triggers while already loading', () => {
    const { result } = renderHook(() =>
      usePantryPagination(sampleItems, 20, 'default-key'),
    );

    act(() => {
      result.current.loadMore();
      result.current.loadMore(); // Duplicate rapid trigger
    });

    expect(result.current.isLoadingMore).toBe(true);

    act(() => {
      jest.advanceTimersByTime(180);
    });

    // Only incremented once from 1 to 2
    expect(result.current.currentPage).toBe(2);
    expect(result.current.paginatedItems.length).toBe(40);
  });

  it('preserves loaded page on unrelated re-render with same resetKey', () => {
    const resetKey = 'query::scope';
    const { result, rerender } = renderHook(
      ({ key }) => usePantryPagination(sampleItems, 20, key),
      { initialProps: { key: resetKey } },
    );

    act(() => {
      result.current.loadMore();
      jest.advanceTimersByTime(180);
    });
    expect(result.current.currentPage).toBe(2);

    // Re-render with new array reference but identical resetKey
    rerender({ key: resetKey });

    // Page must remain at 2
    expect(result.current.currentPage).toBe(2);
    expect(result.current.paginatedItems.length).toBe(40);
  });

  it('resets pagination when resetKey transitions', () => {
    const resetKey = 'query::scope';
    const { result, rerender } = renderHook(
      ({ key }) => usePantryPagination(sampleItems, 20, key),
      { initialProps: { key: resetKey } },
    );

    act(() => {
      result.current.loadMore();
      jest.advanceTimersByTime(180);
    });
    expect(result.current.currentPage).toBe(2);

    // Filter/query changes -> new resetKey
    rerender({ key: 'new-query::scope' });

    // Must reset to page 1
    expect(result.current.currentPage).toBe(1);
    expect(result.current.paginatedItems.length).toBe(20);
    expect(result.current.isLoadingMore).toBe(false);
  });

  it('resets manually via reset() method', () => {
    const { result } = renderHook(() =>
      usePantryPagination(sampleItems, 20, 'default-key'),
    );

    act(() => {
      result.current.loadMore();
      jest.advanceTimersByTime(180);
    });
    expect(result.current.currentPage).toBe(2);

    act(() => {
      result.current.reset();
    });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.paginatedItems.length).toBe(20);
  });
});
