import { apiClient } from '../../src/api/client';
import { runSync } from '../../src/db/sync';
import { syncQuotaErrorsStore } from '../../src/store/syncQuotaErrorsStore';

jest.mock('../../src/api/client', () => ({
  apiClient: {
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

interface MockRecordRow {
  id: string;
  clientId: string;
  serverId?: string | null;
  status: string;
  pendingSync: boolean;
  pendingDelete: boolean;
  update: (updater: (r: MockRecordRow) => void) => Promise<void>;
  destroyPermanently: () => Promise<void>;
  [key: string]: unknown;
}

const mockRecordsStore = new Map<string, MockRecordRow>();

jest.mock('../../src/db/index', () => {
  const mockCollection = {
    find: jest.fn(async (id: string) => {
      const rec = mockRecordsStore.get(id);
      if (!rec) throw new Error(`Record ${id} not found`);
      return rec;
    }),
    create: jest.fn(async (builder: (r: MockRecordRow) => void) => {
      const newRec: MockRecordRow = {
        id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        clientId: `client-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        status: 'active',
        pendingSync: true,
        pendingDelete: false,
        update: jest.fn(async (updater: (r: MockRecordRow) => void) => {
          updater(newRec);
          mockRecordsStore.set(newRec.id, newRec);
        }),
        destroyPermanently: jest.fn(async () => {
          mockRecordsStore.delete(newRec.id);
        }),
      };
      builder(newRec);
      mockRecordsStore.set(newRec.id, newRec);
      return newRec;
    }),
    query: jest.fn((...conditions: Array<{ left?: string; comparison?: { right?: { value?: unknown } } }>) => ({
      fetch: jest.fn(async () => {
        let results = Array.from(mockRecordsStore.values());
        for (const cond of conditions) {
          if (cond?.left === 'pending_delete') {
            const expected = cond.comparison?.right?.value;
            results = results.filter((r) => Boolean(r.pendingDelete) === Boolean(expected));
          }
          if (cond?.left === 'pending_sync') {
            const expected = cond.comparison?.right?.value;
            results = results.filter((r) => Boolean(r.pendingSync) === Boolean(expected));
          }
        }
        return results;
      }),
    })),
  };

  return {
    database: {
      get: jest.fn(() => mockCollection),
      write: jest.fn(async (action: () => Promise<unknown>) => action()),
    },
  };
});

describe('Sync Quota Resilience & Drainage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordsStore.clear();
    syncQuotaErrorsStore.clear();
  });

  it('isolates 409 ITEM_LIMIT_REACHED on POST create and preserves pendingSync without throwing', async () => {
    const rec: MockRecordRow = {
      id: 'rec-1',
      clientId: 'client-overflow-1',
      serverId: null,
      customName: 'Overflow Apple',
      expiryDate: '2026-10-01',
      quantity: 1,
      unit: 'pcs',
      status: 'active',
      pendingSync: true,
      pendingDelete: false,
      update: jest.fn(async (fn) => fn(rec)),
      destroyPermanently: jest.fn(async () => { mockRecordsStore.delete('rec-1'); }),
    };
    mockRecordsStore.set(rec.id, rec);

    // Mock API returning 409 item_limit_reached for POST /records
    (apiClient.post as jest.Mock).mockImplementation(async (url: string) => {
      if (url === '/records') {
        const err = new Error('Quota reached') as Error & { status: number; response: { status: number; data: { code: string } } };
        err.status = 409;
        err.response = { status: 409, data: { code: 'item_limit_reached' } };
        throw err;
      }
      if (url === '/records/sync') {
        return {
          serverTime: new Date().toISOString(),
          changes: [],
          deletedIds: [],
          conflicts: [],
          hasMore: false,
        };
      }
      return {};
    });

    // runSync must not throw
    await expect(runSync()).resolves.toBeUndefined();

    // The item was marked with quota error
    expect(syncQuotaErrorsStore.has('client-overflow-1')).toBe(true);
    // pendingSync is preserved so it will retry later
    expect(rec.pendingSync).toBe(true);
  });

  it('isolates 409 ITEM_LIMIT_REACHED on PATCH restoration and continues processing', async () => {
    const rec: MockRecordRow = {
      id: 'rec-2',
      serverId: 'server-2',
      clientId: 'client-restore-1',
      status: 'active', // attempting to reactivate
      pendingSync: true,
      pendingDelete: false,
      update: jest.fn(async (fn) => fn(rec)),
      destroyPermanently: jest.fn(async () => { mockRecordsStore.delete('rec-2'); }),
    };
    mockRecordsStore.set(rec.id, rec);

    (apiClient.patch as jest.Mock).mockImplementation(async () => {
      const err = new Error('Quota reached') as Error & { status: number; response: { status: number; data: { code: string } } };
      err.status = 409;
      err.response = { status: 409, data: { code: 'item_limit_reached' } };
      throw err;
    });

    (apiClient.post as jest.Mock).mockResolvedValue({
      serverTime: new Date().toISOString(),
      changes: [],
      deletedIds: [],
      conflicts: [],
      hasMore: false,
    });

    await expect(runSync()).resolves.toBeUndefined();
    expect(syncQuotaErrorsStore.has('client-restore-1')).toBe(true);
  });

  it('deletes pending_delete records first so destroyed models are never posted', async () => {
    const deletedRec: MockRecordRow = {
      id: 'rec-3',
      serverId: 'server-3',
      clientId: 'client-deleted-1',
      status: 'active',
      pendingSync: true,
      pendingDelete: true,
      update: jest.fn(async (fn) => fn(deletedRec)),
      destroyPermanently: jest.fn(async () => { mockRecordsStore.delete('rec-3'); }),
    };
    mockRecordsStore.set(deletedRec.id, deletedRec);

    (apiClient.delete as jest.Mock).mockResolvedValue({});
    (apiClient.post as jest.Mock).mockResolvedValue({
      serverTime: new Date().toISOString(),
      changes: [],
      deletedIds: [],
      conflicts: [],
      hasMore: false,
    });

    await runSync();

    // delete endpoint called
    expect(apiClient.delete).toHaveBeenCalledWith('/records/server-3');
    // POST /records was NOT called for this item
    expect(apiClient.post).not.toHaveBeenCalledWith('/records', expect.anything(), expect.anything());
    // record is destroyed from storage
    expect(mockRecordsStore.has('rec-3')).toBe(false);
  });

  it('drains multiple delta sync pages cleanly with composite cursors', async () => {
    let callCount = 0;
    (apiClient.post as jest.Mock).mockImplementation(async (url: string, body: { cursor?: unknown }) => {
      if (url === '/records/sync') {
        callCount++;
        if (callCount === 1) {
          return {
            serverTime: '2026-10-01T12:00:00.000Z',
            changes: [],
            deletedIds: [],
            conflicts: [],
            hasMore: true,
            nextCursor: { updatedAt: '2026-10-01T10:00:00.000Z', id: 'uuid-page-1' },
          };
        }
        return {
          serverTime: '2026-10-01T12:00:00.000Z',
          changes: [],
          deletedIds: [],
          conflicts: [],
          hasMore: false,
          nextCursor: null,
        };
      }
      return {};
    });

    await runSync();

    expect(callCount).toBe(2);
  });
});
