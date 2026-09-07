// apps/mobile/tests/unit/waste-metrics.test.ts
import { calculatePantryWasteStats } from '../../src/utils/waste-metrics';
import type { LocalRecord } from '../../src/api/records';

function makeRecord(overrides: Partial<LocalRecord> = {}): LocalRecord {
  return {
    id: 'rec-1',
    serverId: 'server-1',
    clientId: 'client-1',
    productId: null,
    customName: 'Apples',
    category: 'Produce',
    expiryDate: '2026-09-10',
    quantity: 1,
    unit: 'pcs',
    price: null,
    store: null,
    notes: null,
    photoUrl: null,
    status: 'active',
    notifyAt: [],
    householdId: null,
    userId: 'user-1',
    consumedAt: null,
    discardedAt: null,
    discardReason: null,
    ...overrides,
  };
}

describe('calculatePantryWasteStats', () => {
  it('handles empty records array with safe defaults', () => {
    const stats = calculatePantryWasteStats([]);
    expect(stats.totalConsumed).toBe(0);
    expect(stats.totalDiscarded).toBe(0);
    expect(stats.totalFinished).toBe(0);
    expect(stats.consumptionRatePercent).toBe(100);
    expect(stats.wasteRatePercent).toBe(0);
    expect(stats.estimatedValueSaved).toBe(0);
    expect(stats.estimatedValueWasted).toBe(0);
    expect(stats.reasonCounts).toEqual({});
  });

  it('calculates 100% consumption when all finished items are consumed', () => {
    const records = [
      makeRecord({ id: '1', status: 'consumed', price: 4.5 }),
      makeRecord({ id: '2', status: 'consumed', price: 3.5 }),
      makeRecord({ id: '3', status: 'active' }), // active items ignored in finished stats
    ];

    const stats = calculatePantryWasteStats(records);
    expect(stats.totalConsumed).toBe(2);
    expect(stats.totalDiscarded).toBe(0);
    expect(stats.totalFinished).toBe(2);
    expect(stats.consumptionRatePercent).toBe(100);
    expect(stats.wasteRatePercent).toBe(0);
    expect(stats.estimatedValueSaved).toBe(8.0);
    expect(stats.estimatedValueWasted).toBe(0);
  });

  it('calculates 100% waste when all finished items are discarded and tallies reasons', () => {
    const records = [
      makeRecord({ id: '1', status: 'discarded', discardReason: 'expired', price: 5.0 }),
      makeRecord({ id: '2', status: 'discarded', discardReason: 'spoiled', price: 2.5 }),
      makeRecord({ id: '3', status: 'discarded', discardReason: 'expired', price: 3.0 }),
    ];

    const stats = calculatePantryWasteStats(records);
    expect(stats.totalConsumed).toBe(0);
    expect(stats.totalDiscarded).toBe(3);
    expect(stats.totalFinished).toBe(3);
    expect(stats.consumptionRatePercent).toBe(0);
    expect(stats.wasteRatePercent).toBe(100);
    expect(stats.estimatedValueWasted).toBe(10.5);
    expect(stats.reasonCounts).toEqual({
      expired: 2,
      spoiled: 1,
    });
  });

  it('accurately calculates mixed rates, financial impact, and reason defaults', () => {
    const records = [
      makeRecord({ id: '1', status: 'consumed', price: 10 }),
      makeRecord({ id: '2', status: 'consumed', price: 15 }),
      makeRecord({ id: '3', status: 'consumed', price: 5 }),
      makeRecord({ id: '4', status: 'discarded', discardReason: 'overbought', price: 6 }),
      makeRecord({ id: '5', status: 'discarded', discardReason: null }), // fallback to 'other'
    ];

    const stats = calculatePantryWasteStats(records);
    expect(stats.totalConsumed).toBe(3);
    expect(stats.totalDiscarded).toBe(2);
    expect(stats.totalFinished).toBe(5);
    expect(stats.consumptionRatePercent).toBe(60); // 3 / 5 = 60%
    expect(stats.wasteRatePercent).toBe(40);        // 2 / 5 = 40%
    expect(stats.estimatedValueSaved).toBe(30);
    expect(stats.estimatedValueWasted).toBe(6);
    expect(stats.reasonCounts).toEqual({
      overbought: 1,
      other: 1,
    });
  });

  it('handles records with missing or non-finite price without NaN errors', () => {
    const records = [
      makeRecord({ id: '1', status: 'consumed', price: null }),
      makeRecord({ id: '2', status: 'consumed', price: NaN as any }),
      makeRecord({ id: '3', status: 'discarded', price: undefined as any }),
    ];

    const stats = calculatePantryWasteStats(records);
    expect(stats.estimatedValueSaved).toBe(0);
    expect(stats.estimatedValueWasted).toBe(0);
    expect(Number.isFinite(stats.estimatedValueSaved)).toBe(true);
    expect(Number.isFinite(stats.estimatedValueWasted)).toBe(true);
  });
});
