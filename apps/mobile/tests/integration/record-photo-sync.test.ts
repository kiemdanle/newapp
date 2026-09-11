import { createLocalRecord, deleteLocalRecord } from '../../src/api/records';
import { getRecordLocalPhotos } from '../../src/features/records/record-photo-storage';
import { getWirePhotoUrl } from '../../src/db/sync';
import { recordsStore } from '../../src/db/index';

interface MockRecordRow {
  id: string;
  clientId?: string;
  photoUrl?: string | null;
  update: (updater: (r: MockRecordRow) => void) => Promise<void>;
  destroyPermanently: () => Promise<void>;
  [key: string]: unknown;
}

jest.mock('../../src/db/index', () => {
  const recordsStore = new Map<string, MockRecordRow>();

  const mockCollection = {
    find: jest.fn(async (id: string) => {
      const rec = recordsStore.get(id);
      if (!rec) throw new Error(`Record ${id} not found`);
      return rec;
    }),
    create: jest.fn(async (builder: (r: MockRecordRow) => void) => {
      const newRec: MockRecordRow = {
        id: `mock-rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        update: jest.fn(async (updater: (r: MockRecordRow) => void) => {
          updater(newRec);
          recordsStore.set(newRec.id, newRec);
        }),
        destroyPermanently: jest.fn(async () => {
          recordsStore.delete(newRec.id);
        }),
      };
      builder(newRec);
      recordsStore.set(newRec.id, newRec);
      return newRec;
    }),
    query: jest.fn(() => ({
      fetch: jest.fn(async () => Array.from(recordsStore.values())),
    })),
  };

  return {
    database: {
      get: jest.fn(() => mockCollection),
      write: jest.fn(async (action: () => Promise<unknown>) => action()),
    },
    RecordModel: class {},
    recordsStore,
  };
});

jest.mock('../../src/db/triggers', () => ({
  triggerSyncSoon: jest.fn(),
}));

describe('Record Photo Storage & Sync Contract', () => {
  beforeEach(() => {
    recordsStore.clear();
    jest.clearAllMocks();
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

    const rec = recordsStore.get(localId);
    expect(rec).toBeTruthy();
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

    const rec = recordsStore.get(localId);
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

    const rec = recordsStore.get(localId);
    expect((await getRecordLocalPhotos(rec.clientId)).length).toBe(1);

    await deleteLocalRecord(localId);
    expect((await getRecordLocalPhotos(rec.clientId)).length).toBe(0);
  });
});
