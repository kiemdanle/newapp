import { filterAndSortRecords } from '../../src/features/records/filterAndSortRecords';
import type { LocalRecord } from '../../src/api/records';
import type { PantryFilterState } from '../../src/features/records/pantryFilterTypes';

function generate500Records(): LocalRecord[] {
  const categories = ['Dairy', 'Produce', 'Bakery', 'Pantry', 'Meat', 'Beverages', 'Snacks'];
  const units = ['pcs', 'cartons', 'bottles', 'kg', 'g', 'bags'];
  const stores = ["Trader Joe's", 'Whole Foods', 'Costco', 'Safeway', 'Target'];
  const records: LocalRecord[] = [];

  const baseTime = new Date('2026-09-01T00:00:00Z').getTime();

  for (let i = 0; i < 500; i++) {
    const dayOffset = (i % 60) - 10; // some expired, some soon, some far
    const expDate = new Date(baseTime + dayOffset * 86400000).toISOString().slice(0, 10);
    const isShared = i % 3 === 0;

    records.push({
      id: `rec-perf-${i}`,
      serverId: `srv-${i}`,
      clientId: `cli-${i}`,
      productId: i % 5 === 0 ? `prod-${i}` : null,
      customName: `Grocery Item ${i} ${categories[i % categories.length]}`,
      category: categories[i % categories.length] ?? 'Pantry',
      expiryDate: expDate,
      quantity: (i % 10) + 1,
      unit: units[i % units.length] ?? 'pcs',
      price: 2.99 + (i % 15),
      store: stores[i % stores.length] ?? 'Store',
      notes: i % 4 === 0 ? `Notes for item ${i} keep refrigerated` : null,
      photoUrl: null,
      status: 'active',
      notifyAt: [],
      householdId: isShared ? (i % 2 === 0 ? 'hh-1' : 'hh-2') : null,
    });
  }
  return records;
}

describe('Pantry 500-Record <16ms Frame Budget Performance Verification', () => {
  const records500 = generate500Records();

  it('generates exactly 500 records with mixed personal and shared attributes', () => {
    expect(records500).toHaveLength(500);
    const sharedCount = records500.filter((r) => r.householdId !== null).length;
    const personalCount = records500.filter((r) => r.householdId === null).length;
    expect(sharedCount).toBeGreaterThan(100);
    expect(personalCount).toBeGreaterThan(200);
  });

  it('completes default urgency sort across 500 records under 16ms', () => {
    // Warm up JIT
    filterAndSortRecords(records500.slice(0, 50), {}, 'expiry_asc');

    const start = performance.now();
    const result = filterAndSortRecords(records500, {}, 'expiry_asc');
    const duration = performance.now() - start;

    expect(result).toHaveLength(500);
    expect(duration).toBeLessThan(16);
  });

  it('completes text search + category filter across 500 records under 16ms', () => {
    const filters: PantryFilterState = {
      query: 'Dairy',
      category: 'Dairy',
    };

    const start = performance.now();
    const result = filterAndSortRecords(records500, filters, 'expiry_asc');
    const duration = performance.now() - start;

    expect(result.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(16);
  });

  it('completes household scope isolation across 500 records under 16ms', () => {
    const filters: PantryFilterState = {
      householdScope: 'household',
    };

    const start = performance.now();
    const result = filterAndSortRecords(records500, filters, 'expiry_asc');
    const duration = performance.now() - start;

    expect(result.every((r) => r.householdId !== null)).toBe(true);
    expect(duration).toBeLessThan(16);
  });

  it('completes composite multi-criteria filtering across 500 records under 16ms', () => {
    const filters: PantryFilterState = {
      query: 'Item',
      category: 'Produce',
      expiryStatus: 'all',
      inStockOnly: true,
      householdScope: 'personal',
    };

    const start = performance.now();
    const result = filterAndSortRecords(records500, filters, 'expiry_desc');
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(16);
  });
});
