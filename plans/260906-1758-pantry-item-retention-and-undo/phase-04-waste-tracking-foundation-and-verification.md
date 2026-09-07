---
phase: 4
title: "Waste-Tracking Foundation & Verification"
status: complete
priority: P2
effort: "1 day"
dependencies: ["phase-01-database-schema-and-sync-architecture", "phase-02-local-state-and-immediate-undo", "phase-03-pantry-history-and-stored-items-view"]
---

# Phase 4: Waste-Tracking Foundation & Verification

<!-- Updated: Validation Session 1 - Added discard reason metrics breakdown to analytics helper -->
<!-- Updated: Validation Session 2 - Added test suites for giveaway guard, partial quantity deduction, and rapid undo -->
<!-- Updated: Red Team Review Session 1 - Applied findings 2 (partial quantity splitting verification), 8 (offline sync timestamp fidelity), 9 (revoked-household fallback verification) -->

## Overview
Establish the data metrics and calculation helpers needed for future waste-tracking features (food waste reduction rate, monetary loss tracking, waste reason breakdown) and execute a comprehensive verification suite across local databases, sync protocol, giveaway interactions, and user workflows.

## Requirements
- Functional:
  - Add waste analytics calculation helpers in `apps/mobile/src/utils/waste-metrics.ts`:
    - `calculatePantryWasteStats(records: LocalRecord[])`: calculates total items consumed vs discarded, consumption percentage, total estimated monetary value saved vs lost, and reason breakdown.
  - End-to-end integration verification covering:
    - **Giveaway Guard**: Verify marking an item with an active giveaway is blocked with an alert.
    - **Partial Quantity**: Verify consuming 2 of 6 items decrements active to 4 and creates a consumed entry of 2 with proportional price.
    - **Rapid Undo**: Verify marking items A and B in rapid succession updates the toast to B and both are restorable from History.
    - **Offline Sync Fidelity**: Verify client-supplied timestamps (`consumedAt`, `discardedAt`) and reasons are retained across sync roundtrips without overwrite by server now().
    - **Revoked Household Fallback**: Verify restoring an item from a dissolved/revoked household safely defaults to personal scope (`householdId: null`) and avoids sync failure.
- Non-functional:
  - Zero regression on existing active pantry queries, notification scheduling, or deal/giveaway creation flows.
  - Complete test pass across unit, integration, and typecheck.

## Architecture & Analytics Helpers

### 1. Waste Metrics Calculator (`apps/mobile/src/utils/waste-metrics.ts`)
```typescript
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
  const consumptionRatePercent = totalFinished > 0 ? Math.round((totalConsumed / totalFinished) * 100) : 100;
  const wasteRatePercent = totalFinished > 0 ? Math.round((totalDiscarded / totalFinished) * 100) : 0;

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
```

## Related Code Files
- Create: `apps/mobile/src/utils/waste-metrics.ts`
- Create: `apps/mobile/tests/unit/waste-metrics.test.ts`
- Create: `apps/mobile/tests/integration/pantry-lifecycle-undo.test.tsx`
- Modify: `apps/mobile/app/(app)/pantry/history.tsx`

## Implementation Steps
1. **Analytics Engine**: Implement `calculatePantryWasteStats` in `apps/mobile/src/utils/waste-metrics.ts` to compute consumption rates, waste rates, reason breakdowns, and financial impact.
2. **History Screen KPIs**: Connect `calculatePantryWasteStats` to `PantryHistoryScreen` header to display live summary metrics.
3. **Unit Tests**: Add tests in `apps/mobile/tests/unit/waste-metrics.test.ts` testing edge cases (zero items, items without prices, 100% waste, 100% consumed, reason distribution).
4. **End-to-End Integration Tests**:
   - Write `apps/mobile/tests/integration/pantry-lifecycle-undo.test.tsx` testing the complete lifecycle:
     1. Active record appears in `useActiveRecords`.
     2. Attempt mark with active giveaway $\rightarrow$ blocked.
     3. Consume 2 of 5 items $\rightarrow$ active decremented to 3, consumed entry of 2 created $\rightarrow$ `UndoToast` displayed.
     4. Undo pressed $\rightarrow$ quantity restored to 5.
     5. Discard with reason $\rightarrow$ record leaves active list.
     6. Query `usePantryHistoryRecords('discarded')` $\rightarrow$ item appears with reason and timestamp.
     7. Restore from history for revoked household $\rightarrow$ item reverts to personal scope (`householdId: null`) and returns to active pantry.
5. **Full Regression Run**: Run the entire mobile test suite and backend test suite.

## Success Criteria
- [x] `calculatePantryWasteStats` correctly computes consumption rate, waste percentage, reason counts, and monetary savings/loss.
- [x] Active giveaway guard is verified with automated tests.
- [x] Partial quantity split and restoration are verified.
- [x] Revoked household fallback is verified.
- [x] Offline sync gracefully handles status transitions without data loss or race conditions.
- [x] 100% of unit and integration tests pass without warnings or errors.

## Risk Assessment
- **Risk:** Missing prices on most pantry items leading to $0 estimated waste figures.
  - *Mitigation:* Explicitly display count metric (e.g. "5 items discarded") as primary KPI; show monetary estimate only when $\ge 1$ item has a recorded price.
