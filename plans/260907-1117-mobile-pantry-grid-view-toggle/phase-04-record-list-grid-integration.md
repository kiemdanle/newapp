---
phase: 4
title: "RecordList Grid Integration"
status: completed
priority: P1
effort: "1h"
dependencies: ["phase-02-search-bar-view-toggle-button", "phase-03-pantry-grid-card-component"]
---

# Phase 4: RecordList Grid Integration

## Overview
Integrate 2-column grid rendering into `RecordList.tsx` by chunking section data into 2-item tuples when `viewMode === 'grid'`, preserving the single stable `SectionList` architecture, section headers, search bar focus, pagination, and bulk selection.

## Requirements
- Functional:
  - Read `viewMode` from `useUiPreferencesStore((s) => s.pantryViewMode)`.
  - Pass `viewMode` and `onToggleViewMode` to `PantrySearchBar` in `renderControls()`.
  - When `viewMode === 'grid'`:
    - Chunk each section's data into pairs of 2 items: `[LocalRecord, LocalRecord?]`.
    - Each grid row renders a flexbox row container (`flexDirection: 'row', gap: theme.spacing.md`).
    - Slot 1 renders `<PantryGridCard>` for `item[0]`.
    - Slot 2 renders `<PantryGridCard>` for `item[1]` if present, or an invisible flex spacer `<View style={{ flex: 1 }} />` if the section has an odd number of items.
  - When `viewMode === 'list'`:
    - Render standard full-width `<RecordRow>` items.
  - In section headers (`renderSectionHeader`), display `section.originalCount ?? section.data.length` in both urgent and default branches so item counts do not halve when chunked into pairs.
  - KeyExtractor must stably key rows using composite IDs: `keyExtractor={(item) => Array.isArray(item) ? `${item[0].id}:${item[1]?.id ?? 'empty'}` : item.id}`.
  - SectionList receives `extraData={{ viewMode, selectionMode, selectedIds, householdNames }}` to guarantee instant re-render across mode switches and selection changes.
<!-- Updated: Red Team Session 1 - Composite keys, extraData, & original count headers -->
  - Selection mode:
    - Long-pressing any grid card triggers `selectionMode(true)` and selects that item (guarded if already selecting).
    - Tapping checkboxes or cards in selection mode updates `selectedIds`.
    - Bulk action bar (Move, Cancel) works identically in both list and grid views (note: product has no bulk Delete; single delete remains in detail view).
  - View Mode Toggle Pagination Guard:
    - When `viewMode` flips, immediately reset `onEndReachedCalledDuringMomentumRef.current = true` so the ~50% layout height reduction does not trigger a false `loadMore()` / phantom page append.
<!-- Updated: Red Team Session 1 - Pagination momentum guard on view toggle -->
<!-- Updated: Validation Session 1 - Instant In-Place Swap confirmed -->
- Non-functional:
  - Zero unmounting/remounting of `SectionList`: typing in the search bar while toggling view modes does not lose keyboard focus or cursor position.
  - Smooth 60fps scrolling without layout jitter.

## Architecture & Data Flow

```typescript
// Helper function in RecordList.tsx
function chunkArray<T>(items: T[], size: number = 2): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Inside RecordList:
const viewMode = useUiPreferencesStore((s) => s.pantryViewMode);
const setViewMode = useUiPreferencesStore((s) => s.setPantryViewMode);

// Transformed sections:
const displaySections = useMemo(() => {
  if (viewMode === 'list') {
    return sections.map((s) => ({ ...s, originalCount: s.data.length }));
  }
  return sections.map((s) => ({
    ...s,
    originalCount: s.data.length,
    data: chunkArray(s.data, 2), // Array<[LocalRecord, LocalRecord?]>
  }));
}, [sections, viewMode]);

// RenderItem:
const renderItem = useCallback(
  ({ item }: { item: LocalRecord | LocalRecord[] }) => {
    if (viewMode === 'grid') {
      const pair = item as [LocalRecord, LocalRecord?];
      return (
        <View style={styles.gridRow}>
          <PantryGridCard
            record={pair[0]}
            householdName={pair[0].householdId ? householdNames[pair[0].householdId] : undefined}
            onPress={handlePressItem}
            onLongPress={handleLongPress}
            selectionMode={selectionMode}
            isSelected={selectedIds.has(pair[0].id)}
            onToggleSelect={handleToggleSelect}
          />
          {pair[1] ? (
            <PantryGridCard
              record={pair[1]}
              householdName={pair[1].householdId ? householdNames[pair[1].householdId] : undefined}
              onPress={handlePressItem}
              onLongPress={handleLongPress}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(pair[1].id)}
              onToggleSelect={handleToggleSelect}
            />
          ) : (
            <View style={styles.gridSpacer} />
          )}
        </View>
      );
    }

    return (
      <RecordRow
        record={item as LocalRecord}
        householdName={(item as LocalRecord).householdId ? householdNames[(item as LocalRecord).householdId!] : undefined}
        onPress={handlePressItem}
        onAddQuantity={handleAddQuantity}
        onEdit={handleEdit}
        onDelete={handleDelete}
        selectionMode={selectionMode}
        isSelected={selectedIds.has((item as LocalRecord).id)}
        onLongPress={handleLongPress}
        onToggleSelect={handleToggleSelect}
      />
    );
  },
  [viewMode, householdNames, selectionMode, selectedIds, handlePressItem, handleLongPress, handleToggleSelect, handleAddQuantity, handleEdit, handleDelete],
);
```

## Related Code Files
- Modify: `apps/mobile/src/features/records/RecordList.tsx`
- Modify: `apps/mobile/src/features/records/RecordList.test.tsx`

## Implementation Steps
1. **Connect Store in `RecordList.tsx`**:
   Import `useUiPreferencesStore` and extract `pantryViewMode` and `setPantryViewMode`.
2. **Transform Sections for Grid**:
   Build `displaySections` which wraps section items in pairs of 2 when `viewMode === 'grid'`, retaining `originalCount` for header count rendering.
3. **Implement Grid Row in `renderItem`**:
   Branch on `viewMode === 'grid'` to render `<PantryGridCard>` pairs with flex spacers for odd trailing items.
4. **Pass Props to `PantrySearchBar`**:
   Pass `viewMode` and toggle callback into `renderControls()`.
5. **Update Section Headers**:
   Ensure `renderSectionHeader` reads `section.originalCount` so titles display `Expired · 3` instead of `Expired · 2` (rows).

## Success Criteria
- [x] Toggling view mode switches seamlessly between 1-column list and 2-column grid.
- [x] Section headers (`Expired`, `Expires today`, `Use this week`, `Later`) display correct item counts in both modes.
- [x] Tapping any grid item opens the record detail screen.
- [x] Long-pressing any grid item enters selection mode and enables checkboxes.
- [x] Pagination loads subsequent pages smoothly in grid view.

## Risk Assessment
- *Risk*: KeyExtractor collision if chunked pair uses item.id.
- *Mitigation*: KeyExtractor returns `item[0].id` for grid rows and `item.id` for list rows:
  `keyExtractor={(item) => (Array.isArray(item) ? item[0].id : item.id)}`.
