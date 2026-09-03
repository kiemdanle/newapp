---
phase: 3
title: "Item Card Visual Attribution Badges"
status: completed
priority: P1
effort: "3-4h"
dependencies: ["phase-02-scope-toggle-segmented-control.md"]
---

# Phase 3: Item Card Visual Attribution Badges

## Overview
Enhance `RecordCard` and `RecordList` to visually distinguish shared household groceries from personal items in unified view mode by rendering an accessible, Expyrico-themed attribution badge.

## Requirements
- Functional:
  - Add optional `householdName?: string | null` prop to `RecordCard`.
  - When in unified `'all'` mode and an item has a non-null `record.householdId`:
    - Display an attribution chip with household name (or fallback `"Shared"`).
    - Include a small `people-outline` icon.
  - When in `'personal'` mode, a single `'household'` view, or when an item is personal (`record.householdId === null`):
    - Do not display a shared badge, avoiding redundant clutter when all items in the list share the same scope.
  - In `RecordList.tsx`:
    - Fetch member households via `useMyHouseholds()`.
    - Build a fast ID-to-name lookup map.
    - Forward `householdName` into `RecordRow` and `RecordCard`.
- Non-functional & Visual Standards:
  - Expyrico color requirements:
    - Chip background: Mint Mist (`#D6F0E6`).
    - Chip text: Deep Sage (`#3A8F6F`).
    - Icon color: Deep Sage (`#3A8F6F`).
    - Border: Subtle sage outline (`rgba(75, 174, 138, 0.25)`).
  - Accessibility: Badge text is included in `accessibilityLabel` (e.g. `"[Item Name], Shared in [Household Name], Expires in 3 days"`).

## Architecture
```tsx
// apps/mobile/src/features/records/RecordCard.tsx
interface Props {
  record: LocalRecord;
  onPress: () => void;
  householdName?: string | null;
  // ...
}

export function RecordCard({ record, onPress, householdName, ...rest }: Props) {
  // ...
  const isHouseholdItem = Boolean(record.householdId);
  const badgeLabel = householdName || 'Shared';

  return (
    // ...
    <View style={styles.titleRow}>
      <Text style={styles.name}>{displayName}</Text>
      {isHouseholdItem && (
        <View
          testID={`record-household-badge-${record.id}`}
          style={[styles.householdChip, { backgroundColor: theme.colors.primaryLight, borderColor: 'rgba(75, 174, 138, 0.3)' }]}
        >
          <Ionicons name="people-outline" size={11} color={theme.colors.primaryDark} />
          <Text style={[styles.householdText, { color: theme.colors.primaryDark }]}>
            {badgeLabel}
          </Text>
        </View>
      )}
    </View>
  );
}
```

```tsx
// apps/mobile/src/features/records/RecordList.tsx
const { data: householdsData } = useMyHouseholds();
const householdNames = useMemo(() => {
  const map: Record<string, string> = {};
  for (const h of householdsData?.items ?? []) {
    map[h.id] = h.name;
  }
  return map;
}, [householdsData]);

// Passed to RecordRow:
<RecordRow
  record={record}
  householdName={record.householdId ? householdNames[record.householdId] : undefined}
  // ...
/>
```

## Related Code Files
- Modify:
  - `apps/mobile/src/features/records/RecordCard.tsx`
  - `apps/mobile/src/features/records/RecordList.tsx`
- Create:
  - `apps/mobile/tests/unit/record-card-household-badge.test.tsx`

## Implementation Steps
1. Add `householdName?: string | null` to `RecordCardProps` in `RecordCard.tsx`.
2. Render attribution chip next to item name/brand when `record.householdId` is present.
3. Update `RecordList.tsx` to retrieve households and pass `householdName` into each row.
4. Write unit tests in `apps/mobile/tests/unit/record-card-household-badge.test.tsx`:
   - Renders badge with household name when `householdId` and `householdName` are passed.
   - Renders fallback `"Shared"` when `householdName` is null.
   - Does not render badge for personal items (`householdId === null`).
5. Verify test pass with Jest.

## Success Criteria
- [x] Shared household items display a Mint Mist / Deep Sage badge with `people-outline` icon and household name.
- [x] Personal items render cleanly without an extra badge.
- [x] Screen readers announce household attribution in the accessibility label.
- [x] Unit tests pass with 100% assertions green.

## Risk Assessment
- **Risk**: Badge takes too much horizontal space on long item names, causing text truncation.
- **Mitigation**: Constrain badge max-width with `numberOfLines={1}` and `maxWidth: 120` so item name retains at least 60% of card width.
- **Observable Signal**: Item name clipped to 3 characters on narrow screens.
- **Pre-decided Response**: Apply `maxWidth: 110` with `truncate` on the badge text.
