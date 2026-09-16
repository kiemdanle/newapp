import { apiClient } from '../../src/api/client';
import { runSync } from '../../src/db/sync';

jest.mock('../../src/api/client', () => {
  const actual = jest.requireActual<Record<string, unknown>>('../../src/api/client');
  return {
    ...actual,
    apiClient: {
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      request: jest.fn(),
    },
  };
});
import { getWirePhotoUrl, getWirePhotoUrls } from '../../src/db/sync';
import {
  subscribeRecordPhotoStorage,
  getRecordLocalPhotos,
  saveRecordLocalPhotos,
  clearAllRecordPhotoAttachments,
} from '../../src/features/records/record-photo-storage';
import {
  createLocalRecord,
  patchLocalRecord,
  deleteLocalRecord,
  markRecordStatusWithQuantity,
  restoreLocalRecord,
  uploadRecordPhoto,
  saveRecordPhotos,
} from '../../src/api/records';
import { useSessionStore } from '../../src/auth/session-store';
interface MockRecordRow {
  id: string;
  clientId?: string;
  photoUrl?: string | null;
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
        id: `mock-rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
          if (cond?.left === 'client_id') {
            const expected = cond.comparison?.right?.value;
            results = results.filter((r) => r.clientId === expected);
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
    RecordModel: class {},
  };
});

jest.mock('../../src/db/triggers', () => ({
  triggerSyncSoon: jest.fn(),
}));

describe('Record Photo Storage & Sync Contract', () => {
  beforeEach(async () => {
    mockRecordsStore.clear();
    jest.clearAllMocks();
    await clearAllRecordPhotoAttachments();
    useSessionStore.setState({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        fullName: 'User One',
        role: 'user',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
      } as unknown as Parameters<typeof useSessionStore.setState>[0] extends { user?: infer U } ? NonNullable<U> : never,
      hydrated: true,
    });
  });

  it('separates local photo attachments from server wire state on create', async () => {
    const localPhotos = ['/local/device/photo1.jpg', '/local/device/photo2.jpg'];
    const localId = await createLocalRecord({
      customName: 'Fresh Strawberries',
      expiryDate: '2026-10-15',
      quantity: 2,
      unit: 'pack',
      photoUrl: JSON.stringify(localPhotos),
    });

    const rec = mockRecordsStore.get(localId);
    expect(rec).toBeDefined();
    if (!rec || !rec.clientId) throw new Error('Record not found');
    // Database record stores null for server photoUrl because local paths are device-local
    expect(rec.photoUrl).toBeNull();

    // Local photos are safely stored in device-local storage keyed by clientId
    const saved = await getRecordLocalPhotos(rec.clientId);
    expect(saved).toEqual(localPhotos);

    // Wire sanitizer guarantees server receives null instead of rejected local JSON
    expect(getWirePhotoUrl(rec.photoUrl)).toBeNull();
  });

  it('preserves valid remote URLs for server sync while storing local photos', async () => {
    const localPhotos = ['/local/device/photo1.jpg'];
    const localId = await createLocalRecord({
      customName: 'Organic Milk',
      expiryDate: '2026-10-20',
      quantity: 1,
      unit: 'bottle',
      photoUrl: 'https://cdn.expyrico.app/photos/milk.webp',
      localPhotos,
    });

    const rec = mockRecordsStore.get(localId);
    expect(rec).toBeDefined();
    if (!rec || !rec.clientId) throw new Error('Record not found');
    expect(rec.photoUrl).toBe('https://cdn.expyrico.app/photos/milk.webp');
    expect(getWirePhotoUrl(rec.photoUrl)).toBe('https://cdn.expyrico.app/photos/milk.webp');

    const saved = await getRecordLocalPhotos(rec.clientId);
    expect(saved).toEqual(localPhotos);
  });

  it('removes local attachments when record is deleted', async () => {
    const localPhotos = ['/local/device/photo1.jpg'];
    const localId = await createLocalRecord({
      customName: 'Yogurt',
      expiryDate: '2026-10-25',
      quantity: 1,
      unit: 'tub',
      localPhotos,
    });

    const rec = mockRecordsStore.get(localId);
    expect(rec).toBeDefined();
    if (!rec || !rec.clientId) throw new Error('Record not found');
    expect((await getRecordLocalPhotos(rec.clientId)).length).toBe(1);

    await deleteLocalRecord(localId);
    expect((await getRecordLocalPhotos(rec.clientId)).length).toBe(0);
  });

  it('does not duplicate photo paths when localPhotos is supplied', async () => {
    const localPhotos = ['/local/p1.jpg', '/local/p2.jpg', '/local/p3.jpg'];
    const localId = await createLocalRecord({
      customName: 'Apples',
      expiryDate: '2026-11-01',
      quantity: 3,
      unit: 'pcs',
      localPhotos,
    });

    const rec = mockRecordsStore.get(localId);
    expect(rec).toBeDefined();
    if (!rec || !rec.clientId) throw new Error('Record not found');
    const saved = await getRecordLocalPhotos(rec.clientId);
    // Exactly 3 photos, never duplicated to 6 or falsely exhausting 5-photo limit
    expect(saved).toHaveLength(3);
    expect(saved).toEqual(localPhotos);
  });

  it('exercises runSync create -> pull flow and verifies local attachments survive without server rejection', async () => {
    const localPhotos = ['/local/p1.jpg', '/local/p2.jpg'];
    const localId = await createLocalRecord({
      customName: 'Farm Fresh Eggs',
      expiryDate: '2026-11-15',
      quantity: 12,
      unit: 'pcs',
      localPhotos,
    });

    const rec = mockRecordsStore.get(localId);
    expect(rec).toBeDefined();
    if (!rec || !rec.clientId) throw new Error('Record not found');
    expect(rec.pendingSync).toBe(true);

    let pushedPayload: Record<string, unknown> | null = null;
    (apiClient.post as jest.Mock).mockImplementation(async (path: string, body: Record<string, unknown>) => {
      if (path === '/records') {
        pushedPayload = body;
        return { id: 'server-record-999' };
      }
      if (path === '/records/sync') {
        return {
          changes: [
            {
              id: 'server-record-999',
              clientId: rec.clientId,
              productId: null,
              customName: 'Farm Fresh Eggs',
              brand: null,
              category: null,
              expiryDate: '2026-11-15',
              purchaseDate: null,
              quantity: 12,
              unit: 'pcs',
              notes: null,
              photoUrl: null, // Server returns null for photoUrl
              status: 'active',
              notifyAt: [],
              householdId: null,
              userId: 'user-1',
              consumedAt: null,
              discardedAt: null,
              discardReason: null,
              location: null,
            },
          ],
          deletedIds: [],
          conflicts: [],
          serverTime: new Date().toISOString(),
        };
      }
      return {};
    });

    await runSync();

    // Pushed payload MUST have null photoUrl so server z.string().url() validation never fails
    const pushedRecord = pushedPayload as Record<string, unknown> | null;
    expect(pushedRecord).toBeTruthy();
    expect(pushedRecord?.photoUrl).toBeNull();

    // Pending sync is cleared
    expect(rec.pendingSync).toBe(false);
    expect(rec.serverId).toBe('server-record-999');

    // Local attachments are NOT erased by the server pull
    const localAfterSync = await getRecordLocalPhotos(rec.clientId);
    expect(localAfterSync).toEqual(localPhotos);
  });

  it('hydrates attachments from persistent storage and reactively notifies subscribers', async () => {
    const localPhotos = ['/local/cold/1.jpg', '/local/cold/2.jpg'];
    const clientId = 'client-cold-test';
    await saveRecordLocalPhotos(clientId, localPhotos);

    let notified = false;
    const unsubscribe = subscribeRecordPhotoStorage(() => {
      notified = true;
    });

    // Save update triggers reactive notification
    await saveRecordLocalPhotos(clientId, [...localPhotos, '/local/cold/3.jpg']);
    expect(notified).toBe(true);

    const reloaded = await getRecordLocalPhotos(clientId);
    expect(reloaded).toEqual([...localPhotos, '/local/cold/3.jpg']);

    unsubscribe();
  });

  it('preserves local attachments across split -> history -> undo lifecycle', async () => {
    const localPhotos = ['/local/split/1.jpg', '/local/split/2.jpg'];
    const localId = await createLocalRecord({
      customName: 'Apples',
      expiryDate: '2026-11-20',
      quantity: 5,
      unit: 'pcs',
      localPhotos,
    });

    const parentRec = mockRecordsStore.get(localId);
    expect(parentRec).toBeDefined();
    if (!parentRec || !parentRec.clientId) throw new Error('Parent record not found');
    expect(await getRecordLocalPhotos(parentRec.clientId)).toEqual(localPhotos);

    // Partially consume 2 of 5 apples (creates split history entry)
    const splitResult = await markRecordStatusWithQuantity(localId, 'consumed', 2);
    expect(splitResult.isSplit).toBe(true);
    expect(splitResult.parentId).toBe(localId);

    const historyRec = mockRecordsStore.get(splitResult.affectedId);
    expect(historyRec).toBeDefined();
    if (!historyRec || !historyRec.clientId) throw new Error('History record not found');

    // History record inherits the local photo attachments
    const historyPhotos = await getRecordLocalPhotos(historyRec.clientId);
    expect(historyPhotos).toEqual(localPhotos);

    // Undo the partial consumption
    const undoResult = await restoreLocalRecord(splitResult.affectedId, [], {
      isSplit: true,
      parentId: localId,
      quantity: 2,
    });
    expect(undoResult.mergedBackToParent).toBe(true);

    // History record local attachment key is cleaned up
    const cleanedPhotos = await getRecordLocalPhotos(historyRec.clientId);
    expect(cleanedPhotos).toHaveLength(0);

    // Parent record still has its local photos intact
    const parentPhotosAfterUndo = await getRecordLocalPhotos(parentRec.clientId);
    expect(parentPhotosAfterUndo).toEqual(localPhotos);
  });

  it('restores full gallery (non-cover photos) from server photoUrls across sync and logout', async () => {
    const remotePhotos = [
      'https://cdn.example.com/p1.webp',
      'https://cdn.example.com/p2.webp',
      'https://cdn.example.com/p3.webp',
    ];

    // 1. Initial creation with remote photoUrls
    const localId = await createLocalRecord({
      customName: 'Gourmet Cheese',
      expiryDate: '2026-12-01',
      quantity: 1,
      unit: 'pack',
      photoUrls: remotePhotos,
    });

    const rec = mockRecordsStore.get(localId);
    expect(rec).toBeDefined();
    if (!rec || !rec.clientId) throw new Error('Record not found');
    expect(rec.photoUrl).toBe('https://cdn.example.com/p1.webp');
    expect(rec.photoUrlsJson).toBe(JSON.stringify(remotePhotos));

    // 2. Simulate logout: clearAllRecordPhotoAttachments wipes local AsyncStorage and memory cache
    await clearAllRecordPhotoAttachments();
    const clearedLocal = await getRecordLocalPhotos(rec.clientId);
    expect(clearedLocal).toEqual([]);

    // 3. Simulate login and sync pull: server returns changes with photoUrls
    (apiClient.post as jest.Mock).mockImplementation(async (path: string) => {
      if (path === '/records/sync') {
        return {
          changes: [
            {
              id: 'server-record-cheese',
              clientId: rec.clientId,
              productId: null,
              customName: 'Gourmet Cheese',
              brand: null,
              category: null,
              expiryDate: '2026-12-01',
              purchaseDate: null,
              quantity: 1,
              unit: 'pack',
              notes: null,
              photoUrl: 'https://cdn.example.com/p1.webp',
              photoUrls: remotePhotos,
              status: 'active',
              notifyAt: [],
              householdId: null,
              userId: 'user-1',
              consumedAt: null,
              discardedAt: null,
              discardReason: null,
              location: null,
            },
          ],
          deletedIds: [],
          conflicts: [],
          serverTime: new Date().toISOString(),
        };
      }
      return {};
    });

    await runSync();

    // 4. Verify all photos including non-cover photos are restored in local storage
    const restoredPhotos = await getRecordLocalPhotos(rec.clientId);
    expect(restoredPhotos).toEqual(remotePhotos);
    expect(restoredPhotos).toHaveLength(3);
    expect(rec.photoUrlsJson).toBe(JSON.stringify(remotePhotos));
    expect(rec.photoUrl).toBe('https://cdn.example.com/p1.webp');
  });

  describe('saveRecordPhotos contract', () => {
    it('rejects a server response that did not persist the gallery and preserves dirty item edits', async () => {
      const id = await createLocalRecord({ customName: 'Honey', expiryDate: '2027-01-01', quantity: 2, unit: 'jar' });
      const rec = mockRecordsStore.get(id)!;
      rec.serverId = 'server-honey';
      const urls = ['https://cdn.example.com/a.webp', 'https://cdn.example.com/b.webp'];
      (apiClient.patch as jest.Mock).mockResolvedValueOnce({ id: rec.serverId, photoUrl: urls[0] });
      await expect(saveRecordPhotos(id, urls)).rejects.toThrow();
      expect(rec.photoUrlsJson).toBeNull();
      expect(rec.pendingSync).toBe(true);
      (apiClient.patch as jest.Mock).mockResolvedValueOnce({ id: rec.serverId, photoUrl: urls[0], photoUrls: urls });
      await saveRecordPhotos(id, urls);
      expect(rec.pendingSync).toBe(true);
      expect(rec.quantity).toBe(2);
      expect(await getRecordLocalPhotos(rec.clientId!)).toEqual(urls);
    });

    it('serializes a photo save behind an older background patch so the server keeps the new gallery', async () => {
      const id = await createLocalRecord({ customName: 'Honey', expiryDate: '2027-01-01', quantity: 1, unit: 'jar' });
      const rec = mockRecordsStore.get(id)!;
      rec.serverId = 'server-honey';
      const urls = ['https://cdn.example.com/new.webp'];
      let release!: () => void;
      let entered!: () => void;
      const started = new Promise<void>((resolve) => { entered = resolve; });
      const delayed = new Promise<void>((resolve) => { release = resolve; });
      let serverUrls: unknown;
      (apiClient.patch as jest.Mock).mockImplementation(async (_path: string, body: { photoUrls?: string[]; photoUrl: string | null }) => {
        if (body.photoUrls === undefined) { entered(); await delayed; }
        serverUrls = body.photoUrls;
        return { id: rec.serverId, photoUrl: body.photoUrl, photoUrls: body.photoUrls };
      });
      (apiClient.post as jest.Mock).mockResolvedValue({ changes: [], deletedIds: [], conflicts: [], serverTime: new Date().toISOString() });
      const background = runSync();
      await started;
      const saving = saveRecordPhotos(id, urls);
      await Promise.resolve();
      release();
      await Promise.all([background, saving]);
      expect(serverUrls).toEqual(urls);
      expect(await getRecordLocalPhotos(rec.clientId!)).toEqual(urls);
    });
    it('resolves ONLY when server has acknowledged gallery save and local representation is updated', async () => {
      const localId = await createLocalRecord({
        customName: 'Honey',
        expiryDate: '2027-01-01',
        quantity: 1,
        unit: 'jar',
      });
      const rec = mockRecordsStore.get(localId);
      if (!rec || !rec.clientId) throw new Error('Record not found');
      rec.serverId = 'server-record-honey';
      rec.pendingSync = false;

      const newUrls = ['https://cdn.example.com/h1.webp', 'https://cdn.example.com/h2.webp'];

      (apiClient.patch as jest.Mock).mockResolvedValueOnce({
        id: 'server-record-honey',
        photoUrl: 'https://cdn.example.com/h1.webp',
        photoUrls: newUrls,
      });

      await saveRecordPhotos(localId, newUrls);

      expect(apiClient.patch).toHaveBeenCalledWith('/records/server-record-honey', {
        photoUrls: newUrls,
        photoUrl: 'https://cdn.example.com/h1.webp',
      });

      // Local representation updated
      expect(rec.photoUrlsJson).toBe(JSON.stringify(newUrls));
      expect(rec.photoUrl).toBe('https://cdn.example.com/h1.webp');
      expect(rec.pendingSync).toBe(false);

      const localPhotos = await getRecordLocalPhotos(rec.clientId);
      expect(localPhotos).toEqual(newUrls);
    });

    it('rejects clearly when offline / server fails and does not mark pendingSync false', async () => {
      const localId = await createLocalRecord({
        customName: 'Jam',
        expiryDate: '2027-02-01',
        quantity: 1,
        unit: 'jar',
      });
      const rec = mockRecordsStore.get(localId);
      if (!rec || !rec.clientId) throw new Error('Record not found');
      rec.serverId = 'server-record-jam';

      (apiClient.patch as jest.Mock).mockRejectedValueOnce(new Error('Network request failed'));

      await expect(
        saveRecordPhotos(localId, ['https://cdn.example.com/j1.webp']),
      ).rejects.toThrow('Network request failed');
    });

    it('handles unsynced record creation via runSync, rejecting if sync does not establish serverId', async () => {
      const localId = await createLocalRecord({
        customName: 'Bread',
        expiryDate: '2026-10-01',
        quantity: 1,
        unit: 'loaf',
      });
      const rec = mockRecordsStore.get(localId);
      if (!rec || !rec.clientId) throw new Error('Record not found');
      expect(rec.serverId).toBeFalsy();

      // Mock apiClient.post for /records to fail
      (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Server unavailable'));

      await expect(
        saveRecordPhotos(localId, ['https://cdn.example.com/b1.webp']),
      ).rejects.toThrow(/Failed to sync record|Server unavailable/);
    });

    it('rejects if user session changes during photo save', async () => {
      const localId = await createLocalRecord({
        customName: 'Butter',
        expiryDate: '2026-11-01',
        quantity: 1,
        unit: 'block',
      });
      const rec = mockRecordsStore.get(localId);
      if (!rec || !rec.clientId) throw new Error('Record not found');
      rec.serverId = 'server-record-butter';

      (apiClient.patch as jest.Mock).mockImplementation(async () => {
        // Simulate user sign-out/change mid-flight
        useSessionStore.setState({ user: null });
        return { id: 'server-record-butter', photoUrl: 'https://cdn.example.com/b1.webp' };
      });

      await expect(
        saveRecordPhotos(localId, ['https://cdn.example.com/b1.webp']),
      ).rejects.toThrow(/session changed/i);
    });
  });

  describe('uploadRecordPhoto contract', () => {
    it('preserves content:// and file:// URIs and validates server response URL', async () => {
      let uploadedFormData: FormData | null = null;
      (apiClient.request as jest.Mock).mockImplementation(async (opts: { body: FormData }) => {
        uploadedFormData = opts.body;
        return { photoUrl: 'https://cdn.example.com/uploaded.webp', thumbUrl: 'https://cdn.example.com/thumb.webp' };
      });

      const res = await uploadRecordPhoto({
        path: 'content://media/external/images/media/123',
        mime: 'image/jpeg',
      });

      expect(res.photoUrl).toBe('https://cdn.example.com/uploaded.webp');
      expect(uploadedFormData).toBeDefined();
    });

    it('rejects invalid non-URL server response', async () => {
      (apiClient.request as jest.Mock).mockResolvedValueOnce({ photoUrl: 'not-a-valid-url' });

      await expect(
        uploadRecordPhoto({ path: 'file:///tmp/photo.jpg' }),
      ).rejects.toThrow();
    });
  });
});
