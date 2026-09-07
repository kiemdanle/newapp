// apps/mobile/tests/unit/quantity-split.test.ts
import {
  markRecordStatusWithQuantity,
  restoreLocalRecord,
} from '../../src/api/records';
import { database } from '../../src/db/index';

// Mock watermelon database
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
        id: `mock-new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

const { recordsStore } = require('../../src/db/index');

describe('Quantity Split and Undo Logic', () => {
  beforeEach(() => {
    recordsStore.clear();
    jest.clearAllMocks();
  });

  function createMockRecord(id: string, initialData: Record<string, any>) {
    const rec: any = {
      id,
      quantity: 5,
      unit: 'pcs',
      price: 10.0,
      status: 'active',
      householdId: 'hh-1',
      userId: 'user-1',
      customName: 'Apples',
      productId: null,
      expiryDate: '2026-09-15',
      consumedAt: null,
      discardedAt: null,
      discardReason: null,
      pendingSync: false,
      pendingDelete: false,
      ...initialData,
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

  describe('markRecordStatusWithQuantity', () => {
    it('performs full record transition when marking full quantity', async () => {
      const rec = createMockRecord('rec-1', { quantity: 4, price: 8.0 });

      const result = await markRecordStatusWithQuantity('rec-1', 'consumed', 4);

      expect(result.isSplit).toBe(false);
      expect(result.affectedId).toBe('rec-1');
      expect(result.markedQuantity).toBe(4);

      expect(rec.status).toBe('consumed');
      expect(rec.consumedAt).toBeInstanceOf(Date);
      expect(rec.discardedAt).toBeNull();
      expect(rec.discardReason).toBeNull();
      expect(rec.pendingSync).toBe(true);
    });

    it('performs full record transition with discard reason when discarded', async () => {
      const rec = createMockRecord('rec-1', { quantity: 2 });

      const result = await markRecordStatusWithQuantity('rec-1', 'discarded', 2, 'expired');

      expect(result.isSplit).toBe(false);
      expect(rec.status).toBe('discarded');
      expect(rec.discardedAt).toBeInstanceOf(Date);
      expect(rec.discardReason).toBe('expired');
      expect(rec.consumedAt).toBeNull();
    });

    it('performs partial quantity split, decrementing active and creating history record with proportional price', async () => {
      const parent = createMockRecord('rec-1', {
        quantity: 6,
        price: 12.0, // $2 per unit
        unit: 'cans',
        customName: 'Tuna',
      });

      const result = await markRecordStatusWithQuantity('rec-1', 'discarded', 2, 'spoiled');

      expect(result.isSplit).toBe(true);
      expect(result.parentId).toBe('rec-1');
      expect(result.markedQuantity).toBe(2);

      // Parent is decremented
      expect(parent.quantity).toBe(4);
      expect(parent.status).toBe('active');
      expect(parent.pendingSync).toBe(true);

      // Child history record is created
      const historyRec = recordsStore.get(result.affectedId);
      expect(historyRec).toBeTruthy();
      expect(historyRec.quantity).toBe(2);
      expect(historyRec.price).toBe(4.0); // (12 / 6) * 2 = 4.0
      expect(historyRec.status).toBe('discarded');
      expect(historyRec.discardReason).toBe('spoiled');
      expect(historyRec.discardedAt).toBeInstanceOf(Date);
      expect(historyRec.consumedAt).toBeNull();
      expect(historyRec.pendingSync).toBe(true);
    });

    it('rejects zero or negative quantity with an error', async () => {
      createMockRecord('rec-1', { quantity: 5 });
      await expect(markRecordStatusWithQuantity('rec-1', 'consumed', 0)).rejects.toThrow(
        'Quantity to mark must be greater than zero',
      );
      await expect(markRecordStatusWithQuantity('rec-1', 'consumed', -2)).rejects.toThrow(
        'Quantity to mark must be greater than zero',
      );
    });

    it('safely handles null price split without producing NaN', async () => {
      const parent = createMockRecord('rec-1', { quantity: 4, price: null });
      const result = await markRecordStatusWithQuantity('rec-1', 'consumed', 2);

      expect(parent.price).toBeNull();
      const historyRec = recordsStore.get(result.affectedId);
      expect(historyRec.price).toBeNull();
    });
  });

  describe('restoreLocalRecord', () => {
    it('restores full record back to active status', async () => {
      const rec = createMockRecord('rec-1', {
        status: 'consumed',
        consumedAt: new Date(),
        householdId: 'hh-1',
      });

      const result = await restoreLocalRecord('rec-1', ['hh-1']);

      expect(result.restoredRecordId).toBe('rec-1');
      expect(result.wasReassignedToPersonal).toBe(false);
      expect(result.mergedBackToParent).toBe(false);

      expect(rec.status).toBe('active');
      expect(rec.consumedAt).toBeNull();
      expect(rec.discardedAt).toBeNull();
      expect(rec.discardReason).toBeNull();
      expect(rec.pendingSync).toBe(true);
    });

    it('falls back to personal pantry when household membership was revoked', async () => {
      const rec = createMockRecord('rec-1', {
        status: 'discarded',
        discardedAt: new Date(),
        householdId: 'old-hh-dissolved',
      });

      // User only belongs to ['hh-new'], not 'old-hh-dissolved'
      const result = await restoreLocalRecord('rec-1', ['hh-new']);

      expect(result.wasReassignedToPersonal).toBe(true);
      expect(rec.householdId).toBeNull();
      expect(rec.status).toBe('active');
    });

    it('merges quantity back into active parent on split undo to prevent orphan duplicates', async () => {
      const parent = createMockRecord('parent-1', {
        quantity: 3,
        status: 'active',
      });

      const split = createMockRecord('split-1', {
        quantity: 2,
        status: 'consumed',
      });

      const result = await restoreLocalRecord('split-1', ['hh-1'], {
        isSplit: true,
        parentId: 'parent-1',
        quantity: 2,
      });

      expect(result.mergedBackToParent).toBe(true);
      expect(result.restoredRecordId).toBe('parent-1');

      // Parent restored to 3 + 2 = 5
      expect(parent.quantity).toBe(5);
      expect(parent.pendingSync).toBe(true);

      // Split record is removed permanently
      expect(recordsStore.has('split-1')).toBe(false);
    });

    it('falls back to standard restore if parent record was deleted', async () => {
      const split = createMockRecord('split-orphan', {
        quantity: 2,
        status: 'consumed',
      });

      const result = await restoreLocalRecord('split-orphan', ['hh-1'], {
        isSplit: true,
        parentId: 'parent-does-not-exist',
        quantity: 2,
      });

      expect(result.mergedBackToParent).toBe(false);
      expect(result.restoredRecordId).toBe('split-orphan');
      expect(split.status).toBe('active');
    });
  });
});
