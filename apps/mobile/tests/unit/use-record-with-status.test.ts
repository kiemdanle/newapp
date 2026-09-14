import { renderHook, act } from '@testing-library/react-native';
import { useRecordWithStatus } from '../../src/api/records';
import { useSyncStateStore } from '../../src/store/syncStateStore';

// In Jest, variables referenced in jest.mock must start with `mock`
const mockQueryListeners = new Set<(matches: any[]) => void>();

const mockModelListeners = new Map<string, Set<(model: any) => void>>();

jest.mock('../../src/db', () => ({
  database: {
    get: jest.fn(() => ({
      query: jest.fn(() => ({
        observe: jest.fn(() => ({
          subscribe: (callback: (matches: any[]) => void) => {
            mockQueryListeners.add(callback);
            return {
              unsubscribe: () => {
                mockQueryListeners.delete(callback);
              },
            };
          },
        })),
        observeWithColumns: jest.fn(() => ({
          subscribe: (callback: (matches: any[]) => void) => {
            mockQueryListeners.add(callback);
            return {
              unsubscribe: () => {
                mockQueryListeners.delete(callback);
              },
            };
          },
        })),
      })),
    })),
  },
  RecordModel: class RecordModel {},
  ProductCacheModel: class ProductCacheModel {},
}));

describe('useRecordWithStatus hook - slow sync and observable insertion lifecycle', () => {
  const emitQueryMatches = (matches: any[]) => {
    mockQueryListeners.forEach((listener) => listener(matches));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryListeners.clear();
    useSyncStateStore.setState({ isSyncing: false, initialSyncCompleted: true });
  });
  const createMockModel = (id: string, initialFields: Record<string, any>) => {
    let currentFields = { id, ...initialFields };
    if (!mockModelListeners.has(id)) {
      mockModelListeners.set(id, new Set());
    }
    const model = {
      ...currentFields,
      observe: jest.fn(() => ({
        subscribe: (callback: (updated: any) => void) => {
          mockModelListeners.get(id)!.add(callback);
          return {
            unsubscribe: () => {
              mockModelListeners.get(id)?.delete(callback);
            },
          };
        },
      })),
      updateFields: (patch: Record<string, any>) => {
        currentFields = { ...currentFields, ...patch };
        const updatedModel = {
          ...currentFields,
          observe: model.observe,
          updateFields: model.updateFields,
        };
        mockModelListeners.get(id)?.forEach((fn) => fn(updatedModel));
      },
    };
    return model;
  };

  it('keeps isResolved false and record null when lookup is empty but sync is in flight', () => {
    useSyncStateStore.setState({ isSyncing: true, initialSyncCompleted: false });

    const { result } = renderHook(() => useRecordWithStatus('rec-sync-slow'));

    // Database returns empty array while sync is slow
    act(() => {
      emitQueryMatches([]);
    });

    expect(result.current.record).toBeNull();
    expect(result.current.isResolved).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it('updates to populated record as soon as slow sync inserts the record', () => {
    useSyncStateStore.setState({ isSyncing: true, initialSyncCompleted: false });

    const { result } = renderHook(() => useRecordWithStatus('rec-sync-slow'));

    // 1. Initially empty while syncing
    act(() => {
      emitQueryMatches([]);
    });
    expect(result.current.isResolved).toBe(false);
    expect(result.current.record).toBeNull();

    // 2. Incoming sync inserts the record into SQLite
    const insertedModel = {
      id: 'wm-rec-1',
      serverId: 'rec-sync-slow',
      clientId: 'cli-sync-1',
      productId: 'prod-100',
      customName: 'Synced Green Tea',
      brand: 'TeaCo',
      category: 'Beverages',
      expiryDate: '2026-10-15',
      quantity: 2,
      unit: 'pack',
      price: 5.99,
      store: 'Market',
      notes: null,
      photoUrl: null,
      status: 'active',
      notifyAtJson: '[]',
      householdId: null,
      userId: 'user-1',
      consumedAt: null,
      discardedAt: null,
      discardReason: null,
      location: null,
    };

    act(() => {
      emitQueryMatches([insertedModel]);
    });

    expect(result.current.isResolved).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.record).toBeTruthy();
    expect(result.current.record?.customName).toBe('Synced Green Tea');
    expect(result.current.record?.serverId).toBe('rec-sync-slow');
  });
  it('reacts to live detail field edits (e.g. quantity stepper or name patch) via model observation', () => {
    const model = createMockModel('rec-live', {
      serverId: 'srv-live',
      clientId: 'cli-live',
      customName: 'Original Bread',
      quantity: 1,
      unit: 'loaf',
      status: 'active',
      expiryDate: '2026-10-01',
      notifyAtJson: '[]',
    });

    const { result } = renderHook(() => useRecordWithStatus('rec-live'));

    // Emit matching model
    act(() => {
      emitQueryMatches([model]);
    });

    expect(result.current.record?.customName).toBe('Original Bread');
    expect(result.current.record?.quantity).toBe(1);

    // Live update: user steps quantity to 2
    act(() => {
      model.updateFields({ quantity: 2 });
    });

    expect(result.current.record?.quantity).toBe(2);
    expect(result.current.isResolved).toBe(true);
  });

  it('settles to empty record when slow sync completes without inserting the record', () => {
    useSyncStateStore.setState({ isSyncing: true, initialSyncCompleted: false });

    const { result } = renderHook(() => useRecordWithStatus('rec-never-found'));

    // Empty while syncing
    act(() => {
      emitQueryMatches([]);
    });
    expect(result.current.isResolved).toBe(false);

    // Sync completes and settles
    act(() => {
      useSyncStateStore.setState({ isSyncing: false, initialSyncCompleted: true });
    });

    expect(result.current.isResolved).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.record).toBeNull();
  });

  it('handles slow sync >4s: remains loading and does not settle to not-found while sync is actively running', () => {
    jest.useFakeTimers();
    useSyncStateStore.setState({ isSyncing: true, initialSyncCompleted: false });

    const { result } = renderHook(() => useRecordWithStatus('rec-slow-sync-over-4s'));

    act(() => {
      emitQueryMatches([]);
    });

    // Advance 5 seconds while sync is actively running
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Since sync is still actively running, it MUST remain in loading state, not settle as not-found!
    expect(result.current.isResolved).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.record).toBeNull();
    expect(result.current.isError).toBe(false);

    jest.useRealTimers();
  });

  it('settles to retryable error state when sync completes with an error instead of not-found', () => {
    useSyncStateStore.setState({ isSyncing: true, initialSyncCompleted: false });

    const { result } = renderHook(() => useRecordWithStatus('rec-sync-failed'));

    act(() => {
      emitQueryMatches([]);
    });
    expect(result.current.isResolved).toBe(false);

    // Sync ends with a network failure
    act(() => {
      useSyncStateStore.setState({
        isSyncing: false,
        initialSyncCompleted: true,
        lastSyncError: 'Network request failed',
      });
    });

    expect(result.current.isResolved).toBe(true);
    expect(result.current.isError).toBe(true);
    expect(result.current.errorMessage).toBe('Network request failed');
    expect(result.current.record).toBeNull();
    expect(typeof result.current.retry).toBe('function');
  });

  it('settles to retryable error state after 8s bounded fail-safe timeout instead of Item not found', () => {
    jest.useFakeTimers();
    useSyncStateStore.setState({ isSyncing: false, initialSyncCompleted: false });

    const { result } = renderHook(() => useRecordWithStatus('rec-timeout-test'));

    act(() => {
      emitQueryMatches([]);
    });
    expect(result.current.isResolved).toBe(false);

    // Advance past 8s bounded fail-safe timeout
    act(() => {
      jest.advanceTimersByTime(8500);
    });

    expect(result.current.isResolved).toBe(true);
    expect(result.current.isError).toBe(true);
    expect(result.current.errorMessage).toContain('Unable to load item');
    expect(result.current.record).toBeNull();
    expect(typeof result.current.retry).toBe('function');

    jest.useRealTimers();
  });

  it('synchronously resets resolution state on ID change to prevent stale render pass leakage', () => {
    const { result, rerender } = renderHook(({ id }) => useRecordWithStatus(id), {
      initialProps: { id: 'rec-first' },
    });

    // Settle first record
    act(() => {
      emitQueryMatches([
        {
          id: 'rec-first',
          serverId: 'srv-1',
          clientId: 'cli-1',
          customName: 'First Item',
          notifyAtJson: '[]',
          status: 'active',
          expiryDate: '2026-10-01',
          quantity: 1,
          unit: 'pcs',
        },
      ]);
    });
    expect(result.current.isResolved).toBe(true);
    expect(result.current.record?.customName).toBe('First Item');

    // Change to second ID — must synchronously report isResolved: false, record: null
    rerender({ id: 'rec-second' });

    expect(result.current.record).toBeNull();
    expect(result.current.isResolved).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });
});
