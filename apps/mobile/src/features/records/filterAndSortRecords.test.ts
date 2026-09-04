// apps/mobile/src/features/records/filterAndSortRecords.test.ts
import { filterAndSortRecords } from './filterAndSortRecords';
import type { LocalRecord } from '../../api/records';

function makeRecord(overrides: Partial<LocalRecord> = {}): LocalRecord {
  return {
    id: overrides.id ?? 'rec-1',
    serverId: null,
    clientId: 'client-1',
    productId: overrides.productId ?? null,
    customName: overrides.customName ?? null,
    category: overrides.category ?? null,
    expiryDate: overrides.expiryDate ?? '2026-09-10',
    quantity: overrides.quantity ?? 1,
    unit: 'pcs',
    price: null,
    store: overrides.store ?? null,
    notes: overrides.notes ?? null,
    photoUrl: null,
    status: 'active',
    notifyAt: [],
    householdId: overrides.householdId ?? null,
  };
}

describe('filterAndSortRecords', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-03T12:00:00Z'));
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  const sampleRecords: LocalRecord[] = [
    makeRecord({
      id: 'rec-1',
      customName: 'Organic Whole Milk',
      category: 'Dairy',
      expiryDate: '2026-09-01', // Expired relative to 2026-09-03
      quantity: 2,
      store: 'Trader Joe\'s',
      notes: 'For baking',
    }),
    makeRecord({
      id: 'rec-2',
      customName: 'Greek Yogurt',
      category: 'Dairy',
      expiryDate: '2026-09-05', // Expiring soon
      quantity: 0,
      store: 'Costco',
    }),
    makeRecord({
      id: 'rec-3',
      productId: 'prod-banana',
      category: 'Produce',
      expiryDate: '2026-09-04', // Expiring soon
      quantity: 6,
      store: 'Whole Foods',
    }),
    makeRecord({
      id: 'rec-4',
      customName: 'Canned Tomatoes',
      category: 'Pantry',
      expiryDate: '2027-01-01', // Good
      quantity: 4,
      householdId: 'hh-123',
    }),
  ];

  const productNameLookup = {
    'prod-banana': 'Organic Cavendish Bananas',
  };

  it('returns empty array when records array is empty', () => {
    expect(filterAndSortRecords([])).toEqual([]);
  });

  describe('search query filtering', () => {
    it('matches customName case-insensitively', () => {
      const results = filterAndSortRecords(sampleRecords, { query: 'milk' });
      expect(results.map((r) => r.id)).toEqual(['rec-1']);
    });

    it('matches product name from lookup', () => {
      const results = filterAndSortRecords(
        sampleRecords,
        { query: 'banana' },
        'expiry_asc',
        productNameLookup,
      );
      expect(results.map((r) => r.id)).toEqual(['rec-3']);
    });

    it('matches category', () => {
      const results = filterAndSortRecords(sampleRecords, { query: 'produce' });
      expect(results.map((r) => r.id)).toEqual(['rec-3']);
    });

    it('matches notes', () => {
      const results = filterAndSortRecords(sampleRecords, { query: 'baking' });
      expect(results.map((r) => r.id)).toEqual(['rec-1']);
    });

    it('matches store', () => {
      const results = filterAndSortRecords(sampleRecords, { query: 'costco' });
      expect(results.map((r) => r.id)).toEqual(['rec-2']);
    });

    it('returns all items when query is whitespace', () => {
      const results = filterAndSortRecords(sampleRecords, { query: '   ' });
      expect(results.length).toBe(sampleRecords.length);
    });
  });

  describe('category filtering', () => {
    it('filters by category exactly and case-insensitively', () => {
      const results = filterAndSortRecords(sampleRecords, { category: 'dairy' });
      expect(results.map((r) => r.id)).toEqual(['rec-1', 'rec-2']);
    });

    it('returns empty when no records match category', () => {
      const results = filterAndSortRecords(sampleRecords, { category: 'Bakery' });
      expect(results).toEqual([]);
    });
  });

  describe('expiryStatus filtering', () => {
    it('filters for expired items only', () => {
      const results = filterAndSortRecords(sampleRecords, { expiryStatus: 'expired' });
      expect(results.map((r) => r.id)).toEqual(['rec-1']);
    });

    it('filters for expiring soon items only', () => {
      const results = filterAndSortRecords(sampleRecords, { expiryStatus: 'expiring_soon' });
      expect(results.map((r) => r.id)).toEqual(['rec-3', 'rec-2']);
    });

    it('filters for good items only', () => {
      const results = filterAndSortRecords(sampleRecords, { expiryStatus: 'good' });
      expect(results.map((r) => r.id)).toEqual(['rec-4']);
    });
  });

  describe('inStockOnly filtering', () => {
    it('excludes records with quantity <= 0', () => {
      const results = filterAndSortRecords(sampleRecords, { inStockOnly: true });
      expect(results.map((r) => r.id)).not.toContain('rec-2');
      expect(results.length).toBe(3);
    });
  });

  describe('householdScope filtering', () => {
    it('filters for personal records only (householdId === null)', () => {
      const results = filterAndSortRecords(sampleRecords, { householdScope: 'personal' });
      expect(results.map((r) => r.id)).toEqual(['rec-1', 'rec-3', 'rec-2']);
    });

    it('filters for household records only (householdId !== null)', () => {
      const results = filterAndSortRecords(sampleRecords, { householdScope: 'household' });
      expect(results.map((r) => r.id)).toEqual(['rec-4']);
    });
  });

  describe('sorting options', () => {
    it('sorts by expiry_asc by default (earliest first)', () => {
      const results = filterAndSortRecords(sampleRecords, {}, 'expiry_asc');
      expect(results.map((r) => r.id)).toEqual(['rec-1', 'rec-3', 'rec-2', 'rec-4']);
    });

    it('sorts by expiry_desc (latest first)', () => {
      const results = filterAndSortRecords(sampleRecords, {}, 'expiry_desc');
      expect(results.map((r) => r.id)).toEqual(['rec-4', 'rec-2', 'rec-3', 'rec-1']);
    });

    it('sorts by name_asc (A to Z)', () => {
      const results = filterAndSortRecords(sampleRecords, {}, 'name_asc', productNameLookup);
      expect(results.map((r) => r.id)).toEqual(['rec-4', 'rec-2', 'rec-3', 'rec-1']);
    });

    it('sorts by name_desc (Z to A)', () => {
      const results = filterAndSortRecords(sampleRecords, {}, 'name_desc', productNameLookup);
      expect(results.map((r) => r.id)).toEqual(['rec-1', 'rec-3', 'rec-2', 'rec-4']);
    });

    it('sorts by quantity_desc (highest first)', () => {
      const results = filterAndSortRecords(sampleRecords, {}, 'quantity_desc');
      expect(results.map((r) => r.id)).toEqual(['rec-3', 'rec-4', 'rec-1', 'rec-2']);
    });

    it('sorts by quantity_asc (lowest first)', () => {
      const results = filterAndSortRecords(sampleRecords, {}, 'quantity_asc');
      expect(results.map((r) => r.id)).toEqual(['rec-2', 'rec-1', 'rec-4', 'rec-3']);
    });

    it('sorts by recently_added (descending by id)', () => {
      const results = filterAndSortRecords(sampleRecords, {}, 'recently_added');
      expect(results.map((r) => r.id)).toEqual(['rec-4', 'rec-3', 'rec-2', 'rec-1']);
    });
  });

  describe('performance benchmark', () => {
    it('filters and sorts 500 records within 16ms frame budget', () => {
      const largeList: LocalRecord[] = [];
      const categories = ['Dairy', 'Produce', 'Bakery', 'Meat', 'Pantry'];
      for (let i = 0; i < 500; i++) {
        largeList.push(
          makeRecord({
            id: `rec-${i}`,
            customName: `Food Item ${i % 50}`,
            category: categories[i % categories.length],
            expiryDate: `2026-09-${String((i % 30) + 1).padStart(2, '0')}`,
            quantity: i % 10,
          }),
        );
      }

      const start = performance.now();
      const filtered = filterAndSortRecords(
        largeList,
        { query: 'item 1', category: 'Dairy', inStockOnly: true },
        'expiry_asc',
      );
      const elapsed = performance.now() - start;

      expect(filtered.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(16); // Must execute within single frame budget
    });
  });
});
