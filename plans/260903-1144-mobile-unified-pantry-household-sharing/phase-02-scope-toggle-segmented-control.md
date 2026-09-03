---
phase: 2
title: "ScopeToggle Segmented Control Update"
status: completed
priority: P1
effort: "3-4h"
dependencies: ["phase-01-start.md"]
---

# Phase 2: ScopeToggle Segmented Control Update

## Overview
Update the top-level `ScopeToggle` component on the Pantry Home screen to present a segmented pill switcher featuring `All`, `Personal`, and member `[Household Names]`, adhering to Expyrico visual design standards.

## Requirements
- Functional:
  - Render a segmented pill control on the pantry screen when user belongs to $\ge 1$ household.
  - Automatically hide the control when the user has zero households (clean, distraction-free UI for solo users).
  - Segment items:
    1. `All`: Shows all pantry items (personal + all member households).
    2. `Personal`: Isolates strictly to user's personal groceries (`householdId === null`).
    3. `[Household Name]`: Isolates strictly to groceries belonging to that household.
  - Tapping a segment updates `usePantryScope` state immediately (`setScope(key, householdId)`).
- Non-functional & UI/UX:
  - Expyrico palette:
    - Active segment: Fresh Sage (`#4BAE8A`) background with white text (`#FFFFFF`) or Deep Sage pressed state.
    - Inactive segment: Transparent with `textMuted` (`#8C8C85`).
    - Track background: Elevated card (`bgElevated`) with hairline border (`#F0F0ED`).
  - Accessibility: `accessibilityRole="button"`, `accessibilityState={{ selected: active }}`, minimum 44x44 dp touch targets, smooth pill shape.

## Architecture
```tsx
// apps/mobile/src/features/households/ScopeToggle.tsx
export function ScopeToggle() {
  const theme = useTheme();
  const { data } = useMyHouseholds();
  const { scope, householdId, setScope } = usePantryScope();

  const households = data?.items ?? [];
  if (households.length === 0) return null;

  const segments: Array<{ key: PantryScope; label: string; householdId?: string | null }> = [
    { key: 'all', label: 'All' },
    { key: 'personal', label: 'Personal' },
    ...households.map((h) => ({
      key: 'household' as PantryScope,
      label: h.name,
      householdId: h.id,
    })),
  ];

  return (
    <View
      testID="scope-toggle"
      style={[styles.track, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}
    >
      {segments.map((seg) => {
        const active =
          scope === seg.key &&
          (seg.key === 'all' || seg.key === 'personal' || seg.householdId === householdId);
        return (
          <Pressable
            key={seg.key === 'all' ? 'all' : seg.key === 'personal' ? 'personal' : seg.householdId}
            testID={`scope-toggle-${seg.key === 'household' ? seg.householdId : seg.key}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Filter pantry: ${seg.label}`}
            onPress={() => setScope(seg.key, seg.householdId ?? null)}
            style={({ pressed }) => [
              styles.segment,
              active && { backgroundColor: theme.colors.primary },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: active ? '#FFFFFF' : theme.colors.textMuted },
                active && { fontWeight: '700' },
              ]}
              numberOfLines={1}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

## Related Code Files
- Modify:
  - `apps/mobile/src/features/households/ScopeToggle.tsx`
- Create:
  - `apps/mobile/tests/unit/scope-toggle.test.tsx`

## Implementation Steps
1. Update segment construction in `ScopeToggle.tsx` to include `{ key: 'all', label: 'All' }` as the first segment.
2. Update active state check to support `seg.key === 'all'`.
3. Refine styling with Expyrico theme tokens (`primary`, `bgElevated`, `border`, `radii.pill`).
4. Write unit tests in `apps/mobile/tests/unit/scope-toggle.test.tsx`:
   - Returns `null` when `useMyHouseholds` returns empty array.
   - Renders 3 segments when 1 household exists (`All`, `Personal`, `Family`).
   - Clicking each segment calls `setScope` with expected arguments.
5. Verify test pass with Jest.

## Success Criteria
- [x] Users with 0 households do not see any scope toggle.
- [x] Users with $\ge 1$ household see `All` as the default first segment.
- [x] Active segment highlights in Expyrico Fresh Sage (`#4BAE8A`) with white text.
- [x] Tapping `All`, `Personal`, or `[Household Name]` switches the active segment and updates the store.
- [x] Unit tests pass with 100% assertions green.

## Risk Assessment
- **Risk**: Long household names (e.g. "Smith-Johnson Weekend Vacation Home") might overflow narrow mobile screens if more than 2 households exist.
- **Mitigation**: Add `numberOfLines={1}` and `ellipsizeMode="tail"`, or wrap in a horizontal scroll view if total segments exceed 3.
- **Observable Signal**: Text truncation or horizontal squishing on 320dp screens.
- **Pre-decided Response**: If segments count > 3, enable horizontal scrolling with `showsHorizontalScrollIndicator={false}`.
