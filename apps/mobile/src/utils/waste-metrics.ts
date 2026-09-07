// apps/mobile/src/utils/waste-metrics.ts
import type { LocalRecord } from '../api/records';

export interface WasteAnalytics {
  totalConsumed: number;
  totalDiscarded: number;
  totalFinished: number;
  consumptionRatePercent: number; // e.g. 85%
  wasteRatePercent: number;        // e.g. 15%
  estimatedValueSaved: number;     // monetary sum of consumed items
  estimatedValueWasted: number;    // monetary sum of discarded items
  reasonCounts: Record<string, number>; // e.g. { expired: 4, spoiled: 1 }
}

export function calculatePantryWasteStats(records: LocalRecord[]): WasteAnalytics {
  let totalConsumed = 0;
  let totalDiscarded = 0;
  let estimatedValueSaved = 0;
  let estimatedValueWasted = 0;
  const reasonCounts: Record<string, number> = {};

  for (const r of records) {
    if (r.status === 'consumed') {
      totalConsumed += 1;
      if (r.price && Number.isFinite(r.price)) {
        estimatedValueSaved += r.price;
      }
    } else if (r.status === 'discarded') {
      totalDiscarded += 1;
      const reason = r.discardReason || 'other';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      if (r.price && Number.isFinite(r.price)) {
        estimatedValueWasted += r.price;
      }
    }
  }

  const totalFinished = totalConsumed + totalDiscarded;
  const consumptionRatePercent =
    totalFinished > 0 ? Math.round((totalConsumed / totalFinished) * 100) : 100;
  const wasteRatePercent =
    totalFinished > 0 ? Math.round((totalDiscarded / totalFinished) * 100) : 0;

  return {
    totalConsumed,
    totalDiscarded,
    totalFinished,
    consumptionRatePercent,
    wasteRatePercent,
    estimatedValueSaved,
    estimatedValueWasted,
    reasonCounts,
  };
}
