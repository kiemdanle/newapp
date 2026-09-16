import { apiClient } from '../../src/api/client';
import { runSync } from '../../src/db/sync';
import { ERROR_CODES } from '@expyrico/shared';

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
  productId?: string | null;
  customName?: string | null;
  brand?: string | null;
  category?: string | null;
  quantity?: number;
  unit?: string;
  expiryDate?: string;
  purchaseDate?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
  photoUrlsJson?: string | null;
  location?: string | null;
  householdId?: string | null;
  userId?: string | null;
  status: string;
  pendingSync: boolean;
  pendingDelete: boolean;
  update: (updater: (r: MockRecordRow) => void) => Promise<void>;
  destroyPermanently: () => Promise<void>;
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

describe('Sync Deleted Product Resilience (Deletion-Wins Contract)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordsStore.clear();
  });

  it('1. Personal record: unlinks productId, preserves all user data, does NOT destroy record', async () => {
    const rec: MockRecordRow = {
      id: 'rec-personal-1',
      clientId: 'client-p-1',
      serverId: null,
      productId: 'prod-deleted-1',
      customName: null,
      brand: 'Organic Farm',
      quantity: 2,
      unit: 'bottles',
      expiryDate: '2026-12-31',
      notes: 'Bought at farmers market',
      photoUrl: 'file:///local/photo.jpg',
      householdId: null,
      status: 'active',
      pendingSync: true,
      pendingDelete: false,
      update: jest.fn(async (fn) => fn(rec)),
      destroyPermanently: jest.fn(async () => {
        mockRecordsStore.delete('rec-personal-1');
      }),
    };
    mockRecordsStore.set(rec.id, rec);

    // First pass: server returns 404 with product_not_found
    (apiClient.post as jest.Mock).mockImplementation(async (url: string) => {
      if (url === '/records') {
        const err = new Error('Product not found') as Error & {
          status: number;
          response: { status: number; data: { code: string } };
        };
        err.status = 404;
        err.response = { status: 404, data: { code: ERROR_CODES.PRODUCT_NOT_FOUND } };
        throw err;
      }
      if (url === '/records/sync') {
        return { serverTime: new Date().toISOString(), changes: [], deletedIds: [], conflicts: [], hasMore: false };
      }
      return {};
    });

    await expect(runSync()).resolves.toBeUndefined();

    // Verify record was NOT destroyed
    expect(rec.destroyPermanently).not.toHaveBeenCalled();
    expect(mockRecordsStore.has('rec-personal-1')).toBe(true);

    // Verify productId was unlinked and fallback name provided
    expect(rec.productId).toBeNull();
    expect(rec.customName).toBe('Organic Farm');
    expect(rec.brand).toBe('Organic Farm');
    expect(rec.quantity).toBe(2);
    expect(rec.unit).toBe('bottles');
    expect(rec.notes).toBe('Bought at farmers market');
    expect(rec.photoUrl).toBe('file:///local/photo.jpg');

    // Verify pendingSync is preserved for next sync pass
    expect(rec.pendingSync).toBe(true);

    // Second pass: now that productId is unlinked, the custom item POST succeeds
    (apiClient.post as jest.Mock).mockImplementation(async (url: string, body?: Record<string, unknown>) => {
      if (url === '/records') {
        expect(body?.productId).toBeNull();
        expect(body?.customName).toBe('Organic Farm');
        return { id: 'server-rec-1' };
      }
      if (url === '/records/sync') {
        return { serverTime: new Date().toISOString(), changes: [], deletedIds: [], conflicts: [], hasMore: false };
      }
      return {};
    });

    await expect(runSync()).resolves.toBeUndefined();
    expect(rec.serverId).toBe('server-rec-1');
    expect(rec.pendingSync).toBe(false);
  });

  it('2. Household record: unlinks productId, preserves householdId, retains pendingSync=true', async () => {
    const rec: MockRecordRow = {
      id: 'rec-household-1',
      clientId: 'client-hh-1',
      serverId: null,
      productId: 'prod-deleted-2',
      customName: 'Secret Sauce',
      brand: 'Chef Brand',
      quantity: 1,
      unit: 'jar',
      expiryDate: '2026-11-15',
      householdId: 'household-uuid-123',
      status: 'active',
      pendingSync: true,
      pendingDelete: false,
      update: jest.fn(async (fn) => fn(rec)),
      destroyPermanently: jest.fn(async () => {
        mockRecordsStore.delete('rec-household-1');
      }),
    };
    mockRecordsStore.set(rec.id, rec);

    // Server returns 404 with product_not_found
    (apiClient.post as jest.Mock).mockImplementation(async (url: string) => {
      if (url === '/records') {
        const err = new Error('Product not found') as Error & {
          status: number;
          response: { status: number; data: { code: string } };
        };
        err.status = 404;
        err.response = { status: 404, data: { code: ERROR_CODES.PRODUCT_NOT_FOUND } };
        throw err;
      }
      if (url === '/records/sync') {
        return { serverTime: new Date().toISOString(), changes: [], deletedIds: [], conflicts: [], hasMore: false };
      }
      return {};
    });

    await expect(runSync()).resolves.toBeUndefined();

    // Verify record was NOT destroyed and householdId was NOT erased
    expect(rec.destroyPermanently).not.toHaveBeenCalled();
    expect(rec.productId).toBeNull();
    expect(rec.householdId).toBe('household-uuid-123');
    // Must NOT be falsely marked synced
    expect(rec.pendingSync).toBe(true);
    expect(rec.customName).toBe('Secret Sauce');

    // On subsequent pass, sync to household succeeds
    (apiClient.post as jest.Mock).mockImplementation(async (url: string, body?: Record<string, unknown>) => {
      if (url === '/records') {
        expect(body?.productId).toBeNull();
        expect(body?.householdId).toBe('household-uuid-123');
        return { id: 'server-hh-rec-1' };
      }
      if (url === '/records/sync') {
        return { serverTime: new Date().toISOString(), changes: [], deletedIds: [], conflicts: [], hasMore: false };
      }
      return {};
    });

    await expect(runSync()).resolves.toBeUndefined();
    expect(rec.serverId).toBe('server-hh-rec-1');
    expect(rec.pendingSync).toBe(false);
  });

  it('3. UPDATE operation (serverId exists) on personal record: 404 destroys local record', async () => {
    const rec: MockRecordRow = {
      id: 'rec-existing-1',
      clientId: 'client-ex-1',
      serverId: 'server-record-999',
      productId: 'prod-1',
      customName: 'Old Item',
      householdId: null,
      status: 'consumed',
      pendingSync: true,
      pendingDelete: false,
      update: jest.fn(async (fn) => fn(rec)),
      destroyPermanently: jest.fn(async () => {
        mockRecordsStore.delete('rec-existing-1');
      }),
    };
    mockRecordsStore.set(rec.id, rec);

    // PATCH /records/:id returns 404 (server record itself was removed)
    (apiClient.patch as jest.Mock).mockImplementation(async () => {
      const err = new Error('Record not found') as Error & {
        status: number;
        response: { status: number; data: { code: string } };
      };
      err.status = 404;
      err.response = { status: 404, data: { code: ERROR_CODES.NOT_FOUND } };
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

    // For existing records, a 404 means the record was deleted on server, so destroyPermanently IS called
    expect(rec.destroyPermanently).toHaveBeenCalled();
    expect(mockRecordsStore.has('rec-existing-1')).toBe(false);
  });
});
