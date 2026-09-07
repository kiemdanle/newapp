---
phase: 3
title: "Header Pill Toggle & Tab Switching"
status: completed
priority: P1
effort: "1h"
dependencies: ["phase-02-sectioned-urgency-grouping"]
---

# Phase 3: Header Pill Toggle & Tab Switching

## Overview
Convert the static count pill in `apps/mobile/app/(app)/(tabs)/home.tsx` into an accessible, interactive `<Pressable>` with Honey-themed active styling, two-way toggle behavior, bidirectional state synchronization with `RecordList`, and automatic switching from the `History` tab to the `In Stock` tab upon tap.

## Requirements
- Functional:
  - Replace `<View style={styles.countPill}>` in `home.tsx` with a `<Pressable>` with minimum $44 \times 44\text{ pt}$ effective touch target (`hitSlop={8}`).
  - Tapping toggles `isUrgentActive` between `true` and `false`.
  - When `isUrgentActive === true`:
    - Pill displays active Honey (`#F5A623`) background, distinct active border, and an active filter indicator icon (`funnel` or `checkmark`).
    - `RecordList` receives the urgent filter activation and sets `filters.expiryStatus = 'urgent'`.
  - When `isUrgentActive === false`:
    - Pill reverts to subtle Soft Butter (`#FEEFC3`) background with Honey border.
    - `RecordList` resets `filters.expiryStatus = 'all'`.
  - **Cross-Tab Continuity**: If tapped while `activeTab === 'history'`, automatically switch `activeTab` to `'in_stock'` and apply the urgent filter.
  - **Bidirectional Sync**: If the user clears the urgent filter from inside `RecordList` (e.g. by tapping the filter chip `(X)` or 'Clear active filters'), `RecordList` notifies `HomeTab` via callback, returning the pill to its inactive state.
  - **Scope Reset Sync**: When `RecordList` resets filters due to household scope change via `ScopeToggle`, `onUrgentFilterChange(false)` must be triggered to deactivate the header pill.
<!-- Updated: Validation Session 1 - Funnel icon confirmed, scope reset sync wired -->
  - **Zero Urgent Auto-Reset**: When `totalUrgent` drops to 0, automatically reset `isUrgentActive(false)` to prevent user from being trapped in an empty filtered view.
<!-- Updated: Red Team Session 1 - Auto-reset urgent filter when totalUrgent reaches 0 -->
  - **Midnight Rollover AppState Refresh**: Add an `AppState` listener in `home.tsx` updating date calculations when transitioning from background to active across calendar midnight.
<!-- Updated: Red Team Session 1 - Midnight rollover AppState listener -->
- Non-functional:
  - Follow Expyrico color requirements strictly (`docs/design/expyrico-colour-palette.md`).
  - WCAG 2.1 AA accessibility: `accessibilityRole="button"`, descriptive label, and `accessibilityState={{ selected: isUrgentActive }}`.

## Architecture & Data Flow

```typescript
// home.tsx
const [isUrgentActive, setIsUrgentActive] = useState(false);

const handlePressUrgent = () => {
  if (activeTab === 'history') {
    setActiveTab('in_stock');
    setIsUrgentActive(true);
    return;
  }
  setIsUrgentActive((prev) => !prev);
};

// Header count pill
<Pressable
  testID="home-urgent-pill"
  accessibilityRole="button"
  accessibilityLabel={`${totalUrgent} urgent items. ${isUrgentActive ? 'Filter active, tap to show all.' : 'Tap to filter urgent items.'}`}
  accessibilityState={{ selected: isUrgentActive }}
  hitSlop={8}
  onPress={handlePressUrgent}
  style={({ pressed }) => [
    styles.countPill,
    {
      backgroundColor: isUrgentActive
        ? theme.colors.accent
        : theme.colors.accentLight,
      borderColor: theme.colors.accent,
      borderWidth: 1.5,
      opacity: pressed ? 0.85 : 1,
    },
  ]}
>
  {isUrgentActive ? (
    <Ionicons name="funnel" size={11} color={theme.colors.text} style={{ marginRight: 3 }} />
  ) : null}
  <Text
    style={[
      styles.countText,
      { color: isUrgentActive ? theme.colors.text : theme.colors.primaryDark },
    ]}
  >
    {totalUrgent} urgent
  </Text>
</Pressable>
```

```typescript
// RecordList.tsx synchronization bridge
export interface RecordListProps {
  // ... existing props
  urgentFilterActive?: boolean;
  onUrgentFilterChange?: (active: boolean) => void;
}

// Inside RecordList:
// When parent changes urgentFilterActive:
useEffect(() => {
  if (urgentFilterActive !== undefined) {
    setFilters((prev) => {
      const target = urgentFilterActive ? 'urgent' : 'all';
      if (prev.expiryStatus === target) return prev;
      return { ...prev, expiryStatus: target };
    });
  }
}, [urgentFilterActive]);

// When internal filter changes (e.g. chip cleared):
useEffect(() => {
  onUrgentFilterChange?.(filters.expiryStatus === 'urgent');
}, [filters.expiryStatus, onUrgentFilterChange]);
```

## Related Code Files
- Modify: `apps/mobile/app/(app)/(tabs)/home.tsx`
- Modify: `apps/mobile/src/features/records/RecordList.tsx`

## Implementation Steps
1. **Add Props to `RecordList`**:
   Expose `urgentFilterActive?: boolean` and `onUrgentFilterChange?: (active: boolean) => void` in `RecordListProps`.
2. **Wire Internal Sync in `RecordList`**:
   Add synchronization effects so parent toggle updates `filters.expiryStatus`, and internal resets update parent state.
3. **Refactor Count Pill in `home.tsx`**:
   Replace the `<View>` wrapper with `<Pressable>`, apply touch feedback, dynamic active styles, and accessibility attributes.
4. **Implement Cross-Tab Logic**:
   In `handlePressUrgent`, check `activeTab`. If `'history'`, switch to `'in_stock'` and activate urgent filter.
5. **Verify Theme Tokens**:
   Ensure colors use `theme.colors.accent` (`#F5A623`), `theme.colors.accentLight` (`#FEEFC3`), and `theme.colors.text` (`#2C2C28`).

## Success Criteria
- [x] Count pill is a clickable `<Pressable>` with minimum 44pt touch boundary.
- [x] Tapping the pill toggles `isUrgentActive` and applies/clears urgent filter on the list.
- [x] Tapping the pill while viewing History switches to In Stock tab and applies urgent filter.
- [x] Active state shows distinct visual indicator (filled Honey background + funnel icon).
- [x] TalkBack/VoiceOver correctly announces button role and active/selected state.

## Risk Assessment
- *Risk*: Infinite loop between `urgentFilterActive` prop and `onUrgentFilterChange` callback.
- *Mitigation*: Guard state updates by checking whether the new value actually differs from current state before calling `setFilters` or `onUrgentFilterChange`.
