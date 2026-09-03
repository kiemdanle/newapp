---
phase: 1
title: "Scope State and WatermelonDB Query Expansion"
status: completed
priority: P1
effort: "3-4h"
dependencies: []
---

# Phase 1: Scope State and WatermelonDB Query Expansion

## Overview
Expand the client scope store and local WatermelonDB query mechanics to support `'all'` (unified view) alongside `'personal'` and `'household'`, and enable `householdId` mutation in `patchLocalRecord`.

## Requirements
- Functional:
  - Update `PantryScope` type in `apps/mobile/src/store/pantryScope.ts` to `'all' | 'personal' | 'household'`.
  - Set default scope to `'all'`.
  - Update `useActiveRecords()` in `apps/mobile/src/api/records.ts`:
    - When `scope === 'all'`: omit `household_id` condition to return both personal and shared household items.
    - When `scope === 'personal'`: constrain to `Q.where('household_id', null)`.
    - When `scope === 'household' && householdId`: constrain to `Q.where('household_id', householdId)`.
  - Update `patchLocalRecord` in `apps/mobile/src/api/records.ts`:
    - Include `householdId` in `patch` parameter.
    - Apply `r.householdId = patch.householdId` within database transaction.
    - Trigger background sync (`triggerSyncSoon()`).
- Non-functional:
  - Reactive subscription: WatermelonDB `.observe()` must automatically emit updated rows when records are added, patched, or sync changes arrive.
  - Type safety: 100% typed against `RecordModel` and `LocalRecord`.

## Architecture
```typescript
// apps/mobile/src/store/pantryScope.ts
export type PantryScope = 'all' | 'personal' | 'household';

interface ScopeState {
  scope: PantryScope;
  householdId: string | null;
  setScope: (scope: PantryScope, householdId?: string | null) => void;
}

export const usePantryScope = create<ScopeState>((set) => ({
  scope: 'all',
  householdId: null,
  setScope: (scope, householdId = null) => set({ scope, householdId }),
}));
```

```typescript
// apps/mobile/src/api/records.ts
export function useActiveRecords(): LocalRecord[] {
  const [rows, setRows] = useState<LocalRecord[]>([]);
  const { scope, householdId } = usePantryScope();

  useEffect(() => {
    const col = database.get<RecordModel>('records');
    const conditions = [
      Q.where('status', 'active'),
      Q.where('pending_delete', false),
    ];
    if (scope === 'personal') {
      conditions.push(Q.where('household_id', null));
    } else if (scope === 'household' && householdId) {
      conditions.push(Q.where('household_id', householdId));
    }
    // scope === 'all': unconstrained by household_id

    const sub = col
      .query(...conditions)
      .observe()
      .subscribe((res) => setRows(res.map(toLocal)));
    return () => sub.unsubscribe();
  }, [scope, householdId]);
  return rows;
}
```

## Related Code Files
- Modify:
  - `apps/mobile/src/store/pantryScope.ts`
  - `apps/mobile/src/api/records.ts`
- Create:
  - `apps/mobile/tests/unit/pantry-scope.test.ts`

## Implementation Steps
1. Update `apps/mobile/src/store/pantryScope.ts` to include `'all'` in `PantryScope` and default `scope: 'all'`.
2. Update `useActiveRecords` in `apps/mobile/src/api/records.ts` so `'all'` queries all active records without filtering `household_id`.
3. Update `patchLocalRecord` in `apps/mobile/src/api/records.ts` to accept and update `householdId`.
4. Write unit tests in `apps/mobile/tests/unit/pantry-scope.test.ts` covering store transitions and query condition generation.
5. Run TypeScript compiler to ensure 0 diagnostics.

## Success Criteria
- [x] `usePantryScope` initializes to `scope: 'all'`.
- [x] `useActiveRecords` returns all personal and household records when `scope === 'all'`.
- [x] `useActiveRecords` filters strictly to personal items when `scope === 'personal'`.
- [x] `useActiveRecords` filters strictly to the target household when `scope === 'household'`.
- [x] `patchLocalRecord` updates `householdId` in WatermelonDB and triggers sync.
- [x] Unit tests pass with 100% assertions green.

## Risk Assessment
- **Risk**: Returning all records in `scope === 'all'` might leak records from households the user was removed from.
- **Mitigation**: `purgeHouseholdRecords` in `db/sync.ts` already purges local records belonging to households the user left. The query can only return records that legitimately exist in local storage.
- **Observable Signal**: Stale household records linger after leaving a household.
- **Pre-decided Response**: Ensure `useRemoveMember` and `useDissolveHousehold` continue calling `purgeHouseholdRecords`.
