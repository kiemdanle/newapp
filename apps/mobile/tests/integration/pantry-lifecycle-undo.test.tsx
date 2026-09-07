// apps/mobile/tests/integration/pantry-lifecycle-undo.test.tsx
import {
  markRecordStatusWithQuantity,
  restoreLocalRecord,
  type LocalRecord,
} from '../../src/api/records';
import { calculatePantryWasteStats } from '../../src/utils/waste-metrics';

const { recordsStore } = require('../../src/db/index');

jest.mock('../../src/db/index', () => {
  const recordsStore = new Map<string, any>();

  const mockCollection = {
    find: jest.fn(async (id: string) => {
      const rec = recordsStore.get(id);
      if (!rec) throw new Error(`Record ${id} not found`);
      return rec;
    }),
    create: jest.fn(async (builder: (r: any) => void) => {
      const newRec: any = {
        id: `mock-rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        update: jest.fn(async (updater: (r: any) => void) => {
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
  };

  return {
    database: {
      get: jest.fn(() => mockCollection),
      write: jest.fn(async (action: () => Promise<any>) => action()),
    },
    RecordModel: class {},
    recordsStore,
  };
});

jest.mock('../../src/db/triggers', () => ({
  triggerSyncSoon: jest.fn(),
}));

function seedRecord(id: string, overrides: Record<string, any> = {}) {
  const rec: any = {
    id,
    quantity: 6,
    unit: 'eggs',
    price: 3.0,
    status: 'active',
    householdId: 'hh-1',
    userId: 'user-1',
    customName: 'Farm Fresh Eggs',
    productId: null,
    expiryDate: '2026-09-20',
    consumedAt: null,
    discardedAt: null,
    discardReason: null,
    pendingSync: false,
    pendingDelete: false,
    ...overrides,
    update: jest.fn(async (updater: (r: any) => void) => {
      updater(rec);
      recordsStore.set(rec.id, rec);
    }),
    destroyPermanently: jest.fn(async () => {
      recordsStore.delete(rec.id);
    }),
  };
  recordsStore.set(id, rec);
  return rec;
}

describe('Pantry Lifecycle & Undo Integration', () => {
  beforeEach(() => {
    recordsStore.clear();
    jest.clearAllMocks();
  });

  it('completes the entire partial-split, undo, discard-with-reason, and restore flow', async () => {
    // 1. Initial active pantry item: 6 eggs, $3.00 total ($0.50 each)
    const eggItem = seedRecord('egg-record', { quantity: 6, price: 3.0 });
    expect(eggItem.status).toBe('active');
    expect(eggItem.quantity).toBe(6);

    // 2. Consume 2 eggs
    const splitResult = await markRecordStatusWithQuantity('egg-record', 'consumed', 2);
    expect(splitResult.isSplit).toBe(true);
    expect(splitResult.parentId).toBe('egg-record');
    expect(splitResult.markedQuantity).toBe(2);

    // Active item decremented to 4 eggs ($2.00)
    expect(eggItem.quantity).toBe(4);
    expect(eggItem.price).toBe(2.0);
    expect(eggItem.status).toBe('active');

    // Consumed item created for 2 eggs ($1.00)
    const consumedChild = recordsStore.get(splitResult.affectedId);
    expect(consumedChild).toBeTruthy();
    expect(consumedChild.quantity).toBe(2);
    expect(consumedChild.price).toBe(1.0);
    expect(consumedChild.status).toBe('consumed');
    expect(consumedChild.consumedAt).toBeInstanceOf(Date);

    // 3. Undo the partial consumption
    const undoResult = await restoreLocalRecord(consumedChild.id, ['hh-1'], {
      isSplit: true,
      parentId: 'egg-record',
      quantity: 2,
    });
    expect(undoResult.mergedBackToParent).toBe(true);
    expect(undoResult.restoredRecordId).toBe('egg-record');

    // Active item restored to 6 eggs ($3.00)
    expect(eggItem.quantity).toBe(6);
    expect(eggItem.price).toBe(3.0);
    // Temporary child removed
    expect(recordsStore.has(consumedChild.id)).toBe(false);

    // 4. Mark all 6 eggs as discarded due to being expired
    const discardResult = await markRecordStatusWithQuantity(
      'egg-record',
      'discarded',
      6,
      'expired',
    );
    expect(discardResult.isSplit).toBe(false);
    expect(eggItem.status).toBe('discarded');
    expect(eggItem.discardReason).toBe('expired');
    expect(eggItem.discardedAt).toBeInstanceOf(Date);
    expect(eggItem.consumedAt).toBeNull();

    // 5. Compute waste metrics: reflects 100% waste of $3.00
    const wasteStats = calculatePantryWasteStats(Array.from(recordsStore.values()) as LocalRecord[]);
    expect(wasteStats.totalDiscarded).toBe(1);
    expect(wasteStats.totalConsumed).toBe(0);
    expect(wasteStats.wasteRatePercent).toBe(100);
    expect(wasteStats.estimatedValueWasted).toBe(3.0);
    expect(wasteStats.reasonCounts).toEqual({ expired: 1 });

    // 6. Restore discarded item from history with household revocation
    // User no longer has 'hh-1' membership (only 'hh-2' is accessible)
    const restoreResult = await restoreLocalRecord('egg-record', ['hh-2']);
    expect(restoreResult.wasReassignedToPersonal).toBe(true);
    expect(eggItem.householdId).toBeNull(); // safely reverted to personal scope
    expect(eggItem.status).toBe('active');
    expect(eggItem.discardedAt).toBeNull();
    expect(eggItem.discardReason).toBeNull();
  });
});
