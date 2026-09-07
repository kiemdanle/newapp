---
phase: 2
title: "Local State & Immediate Undo Mechanism"
status: complete
priority: P1
effort: "1 day"
dependencies: ["phase-01-database-schema-and-sync-architecture"]
---

# Phase 2: Local State & Immediate Undo Mechanism

<!-- Updated: Validation Session 1 - Confirmed 6-second floating toast and quick 1-tap discard reason prompt -->
<!-- Updated: Validation Session 2 - Added open giveaway safety guard and multi-quantity partial consumption stepper -->
<!-- Updated: Red Team Review Session 1 - Applied findings 1 (giveaway guard), 2 (partial quantity splitting), 3 (latest toast with history fallback), 5 (dynamic chrome-aware toast positioning), 9 (revoked-household personal fallback on restore) -->

## Overview
Implement the mobile local state transitions, an open giveaway safety guard, a partial quantity selector for multi-item records, a quick 1-tap waste reason prompt upon discarding, and an immediate 6-second floating Undo Toast with dynamic screen positioning.

## Requirements
- Functional:
  - **Giveaway Safety Guard**: Before marking an item as used or discarded in `RecordDetail`, verify if it is referenced by an active giveaway (`status === 'open' || status === 'claimed'`). If active, block the action and present an Alert: `"This item is listed in an active giveaway. Please cancel the giveaway first."`
  - **Partial Quantity Selector**: If `record.quantity > 1`, prompt with `QuantityPromptModal` asking: `"How many to mark as used/discarded? [ - 1 + ] of [N]"`.
    - If full quantity selected: transition the entire record to `'consumed'` or `'discarded'`.
    - If partial quantity selected: decrement the active record's quantity by $M$ (leaving $N-M$ active), and create a new record entry with status `'consumed'` or `'discarded'` with quantity $M$.
  - **Discard Reason Modal**: Light bottom-sheet triggered when discarding offering 5 quick 1-tap options: `Expired`, `Spoiled`, `Overbought`, `Leftovers`, `Other`.
  - **Undo Toast**: Floating animated pill positioned dynamically above bottom tabs (or safe area on non-tab screens) with a 6-second auto-dismiss window reflecting the latest marked action, with an immediate `"Undo"` button.
  - **Household Revocation Fallback**: Tapping "Undo" on the toast executes `restoreLocalRecord(id)`. If the restored item belonged to a household that is no longer accessible (dissolved or member removed), automatically reassign `householdId: null` (restore as a personal pantry item) and notify the user.
- Non-functional:
  - Strict Expyrico design adherence: Almost Black `#2C2C28` elevated surface, Warm White `#FAFAF8` text, Fresh Sage `#4BAE8A` "Undo" button text, rounded pill container with shadow.

## Architecture & Component Design

### 1. Giveaway Guard (`apps/mobile/app/(app)/record/[id].tsx`)
```typescript
const handleInitiateMark = (status: 'consumed' | 'discarded') => {
  if (record.linkedGiveawayId || activeGiveawaysForRecord.length > 0) {
    Alert.alert(
      'Item Listed in Giveaway',
      'This pantry item is currently offered in a community giveaway. Please cancel the giveaway before marking it as used or discarded.',
      [{ text: 'OK', style: 'default' }],
    );
    return;
  }
  if (record.quantity > 1) {
    setShowQuantityModal({ status });
  } else if (status === 'discarded') {
    setShowDiscardReasonModal(true);
  } else {
    executeMark('consumed', record.quantity);
  }
};
```

### 2. Partial Quantity Split & Transition (`apps/mobile/src/api/records.ts`)
```typescript
export async function markRecordStatusWithQuantity(
  id: string,
  status: 'consumed' | 'discarded',
  quantityToMark: number,
  discardReason: string | null = null,
): Promise<string> {
  const col = database.get<RecordModel>('records');
  let affectedId = id;

  await database.write(async () => {
    const rec = await col.find(id);
    if (quantityToMark >= rec.quantity) {
      // Full record transition
      await rec.update((r) => {
        r.status = status;
        if (status === 'consumed') {
          r.consumedAt = new Date();
          r.discardedAt = null;
          r.discardReason = null;
        } else {
          r.discardedAt = new Date();
          r.discardReason = discardReason;
          r.consumedAt = null;
        }
        r.pendingSync = true;
      });
    } else {
      // Partial consumption: decrement active record, create history entry
      const remaining = rec.quantity - quantityToMark;
      await rec.update((r) => {
        r.quantity = remaining;
        r.pendingSync = true;
      });
      const historyRec = await col.create((r) => {
        r.clientId = uuidv4();
        r.productId = rec.productId;
        r.customName = rec.customName;
        r.category = rec.category;
        r.expiryDate = rec.expiryDate;
        r.purchaseDate = rec.purchaseDate;
        r.quantity = quantityToMark;
        r.unit = rec.unit;
        r.price = rec.price ? (rec.price / rec.quantity) * quantityToMark : null;
        r.store = rec.store;
        r.notes = rec.notes;
        r.photoUrl = rec.photoUrl;
        r.householdId = rec.householdId;
        r.userId = rec.userId;
        r.status = status;
        r.consumedAt = status === 'consumed' ? new Date() : null;
        r.discardedAt = status === 'discarded' ? new Date() : null;
        r.discardReason = discardReason;
        r.pendingSync = true;
      });
      affectedId = historyRec.id;
    }
  });
  triggerSyncSoon();
  return affectedId;
}

export async function restoreLocalRecord(id: string, accessibleHouseholdIds: string[] = []): Promise<void> {
  const col = database.get<RecordModel>('records');
  await database.write(async () => {
    const rec = await col.find(id);
    let targetHouseholdId = rec.householdId;
    if (targetHouseholdId && !accessibleHouseholdIds.includes(targetHouseholdId)) {
      targetHouseholdId = null; // Revert to personal pantry if household was revoked
    }
    await rec.update((r) => {
      r.status = 'active';
      r.consumedAt = null;
      r.discardedAt = null;
      r.discardReason = null;
      r.householdId = targetHouseholdId;
      r.pendingSync = true;
    });
  });
  triggerSyncSoon();
}
```

### 3. Dynamic Undo Toast Component (`apps/mobile/src/components/UndoToast.tsx`)
- Calculates offset dynamically based on whether bottom tab bar is active (`insets.bottom + (hasTabBar ? 64 : 16)`).
- Displays latest marked action with a 6-second auto-dismiss.
- Tapping "Undo" executes `restoreLocalRecord(affectedId)`.

## Related Code Files
- Create: `apps/mobile/src/components/QuantityPromptModal.tsx`
- Create: `apps/mobile/src/components/DiscardReasonModal.tsx`
- Create: `apps/mobile/src/store/undoToast.ts`
- Create: `apps/mobile/src/components/UndoToast.tsx`
- Modify: `apps/mobile/src/App.tsx`
- Modify: `apps/mobile/src/api/records.ts`
- Modify: `apps/mobile/app/(app)/record/[id].tsx`
- Create: `apps/mobile/tests/unit/undo-toast.test.tsx`
- Create: `apps/mobile/tests/unit/quantity-split.test.ts`

## Implementation Steps
1. **Giveaway Safety Check**: In `RecordDetail`, query active giveaways for the record and block `mark` if an open giveaway exists.
2. **Quantity Stepper Modal**: Implement `QuantityPromptModal.tsx` allowing user to choose quantity between 1 and $N$.
3. **Discard Reason Modal**: Implement `DiscardReasonModal.tsx` with 5 quick 1-tap options.
4. **State Transitions**: Implement `markRecordStatusWithQuantity` and `restoreLocalRecord` with household fallback in `records.ts`.
5. **UndoToast**: Wire `useUndoToastStore` and `<UndoToast />` mounted in `RootApp` with dynamic positioning.
6. **Unit Tests**: Test giveaway guard, partial quantity splitting, household fallback, and undo execution.

## Success Criteria
- [x] Attempting to mark an item with an open giveaway alerts and halts execution.
- [x] Items with $N > 1$ allow marking a subset (e.g. 2 of 5), decrementing active and logging history.
- [x] 6-second floating toast appears dynamically above visible chrome reflecting the latest action.
- [x] Tapping "Undo" restores the action immediately, falling back to personal pantry if household was revoked.

## Risk Assessment
- **Risk:** Multi-quantity splits creating orphaned duplicate records if undone repeatedly.
  - *Mitigation:* `restoreLocalRecord` checks if the restored record was a split from an active parent and merges quantity back into the original record if still active.
