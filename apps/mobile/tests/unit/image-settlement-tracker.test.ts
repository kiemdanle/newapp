import { act, renderHook } from '@testing-library/react-native';
import { useImageSettlementTracker } from '../../src/cache/useImageSettlementTracker';

describe('useImageSettlementTracker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('evaluates allSettled = true immediately when uris array is empty', () => {
    const { result } = renderHook(() => useImageSettlementTracker([]));

    expect(result.current.allSettled).toBe(true);
    expect(result.current.isSettled('https://example.com/photo.jpg')).toBe(true);
  });

  it('holds allSettled = false until all populated URIs are marked settled', () => {
    const uri1 = 'https://cdn.example.com/img1.jpg';
    const uri2 = 'https://cdn.example.com/img2.jpg';
    const uris = [uri1, uri2];
    const { result } = renderHook(() => useImageSettlementTracker(uris));

    expect(result.current.allSettled).toBe(false);
    expect(result.current.isSettled(uri1)).toBe(false);
    expect(result.current.isSettled(uri2)).toBe(false);

    // Mark first URI as settled
    act(() => {
      result.current.markSettled(uri1);
    });

    expect(result.current.isSettled(uri1)).toBe(true);
    expect(result.current.isSettled(uri2)).toBe(false);
    expect(result.current.allSettled).toBe(false);

    // Mark second URI as settled
    act(() => {
      result.current.markSettled(uri2);
    });

    expect(result.current.isSettled(uri2)).toBe(true);
    expect(result.current.allSettled).toBe(true);
  });

  it('preserves settlement when a settled photo is removed from a multi-photo set without deadlocking', () => {
    const uriA = 'https://cdn.example.com/photo-a.jpg';
    const uriB = 'https://cdn.example.com/photo-b.jpg';
    let currentUris = [uriA, uriB];
    const { result, rerender } = renderHook(() => useImageSettlementTracker(currentUris));

    // Both settle
    act(() => {
      result.current.markSettled(uriA);
      result.current.markSettled(uriB);
    });
    expect(result.current.allSettled).toBe(true);

    // User deletes photo B, leaving only photo A
    currentUris = [uriA];
    rerender({});

    // Since A was already settled, allSettled must remain true immediately!
    expect(result.current.allSettled).toBe(true);
    expect(result.current.isSettled(uriA)).toBe(true);
  });

  it('resets settlement when uris transitions from empty to populated list', () => {
    const itemPhotoUri = 'https://cdn.example.com/item-photo.jpg';
    let currentUris: string[] = [];
    const { result, rerender } = renderHook(() => useImageSettlementTracker(currentUris));

    // Metadata query resolves, supplying photo URLs
    currentUris = [itemPhotoUri];
    rerender({});

    // Must reset to unsettled state
    expect(result.current.allSettled).toBe(false);
    expect(result.current.isSettled(itemPhotoUri)).toBe(false);

    act(() => {
      result.current.markSettled(itemPhotoUri);
    });

    expect(result.current.allSettled).toBe(true);
  });

  it('forces allSettled = true when 3000ms safety timeout expires', () => {
    const stalledUri = 'https://cdn.example.com/stalled-image.jpg';
    const uris = [stalledUri];
    const { result } = renderHook(() => useImageSettlementTracker(uris));

    expect(result.current.allSettled).toBe(false);

    // Advance 2,999ms: still unsettled
    act(() => {
      jest.advanceTimersByTime(2999);
    });
    expect(result.current.allSettled).toBe(false);

    // Advance to 3,000ms safety timeout
    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(result.current.allSettled).toBe(true);
    expect(result.current.isSettled(stalledUri)).toBe(true);
  });
  it('supports custom timeoutMs option', () => {
    const customUri = 'https://cdn.example.com/custom-timeout.jpg';
    const { result } = renderHook(() =>
      useImageSettlementTracker([customUri], { timeoutMs: 1500 }),
    );

    expect(result.current.allSettled).toBe(false);

    act(() => {
      jest.advanceTimersByTime(1499);
    });
    expect(result.current.allSettled).toBe(false);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.allSettled).toBe(true);
  });

  it('cleans up safety timeout on unmount to eliminate timer leaks', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const photoUri = 'https://cdn.example.com/photo.jpg';
    const uris = [photoUri];
    const { unmount } = renderHook(() => useImageSettlementTracker(uris));

    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('clears safety timeout immediately once all URIs settle', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const photoUri = 'https://cdn.example.com/photo.jpg';
    const uris = [photoUri];
    const { result } = renderHook(() => useImageSettlementTracker(uris));

    act(() => {
      result.current.markSettled(photoUri);
    });

    expect(result.current.allSettled).toBe(true);
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
