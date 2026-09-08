---
phase: 2
title: "Reusable LocationSelector and LocationPickerModal Components"
status: pending
priority: P1
effort: "3-4h"
dependencies: ["phase-01-schema-and-database-migrations"]
---

# Phase 2: Reusable LocationSelector and LocationPickerModal Components

## Overview
Develop the reusable `LocationSelector` and `LocationPickerModal` mobile components, matching the visual style, interaction physics, and accessibility standards of `UnitSelector` with 4 fixed quick pills (`Fridge`, `Freezer`, `Pantry`, `Counter`), an adaptive 5th pill (`More ▾` / `${location} ▾`), and tap-to-deselect capability.

## Requirements
- Functional:
  - 4 fixed pills directly selectable in 1 tap: `Fridge`, `Freezer`, `Pantry`, `Counter`.
  - Tap-to-deselect: tapping an active pill clears selection to `null`.
  - 5th adaptive pill: displays `"More ▾"` when unselected or when a top-4 location is active; displays `"${location} ▾"` highlighted in Fresh Sage (`#4BAE8A`) with white text when an alternate/custom location is active.
  - Tapping the 5th pill opens `LocationPickerModal`.
  - `LocationPickerModal` provides:
    - Search / text input with "Apply" button for any custom location.
    - Quick-select chips for common additional locations: `Spice Rack`, `Cupboard`, `Cabinet`, `Basement`, `Cellar`, `Wine Cooler`, `Drawer`, `Office`, `Garage`, `Bar`.
    - "Clear Location" action button to remove selection.
    - Dismiss via backdrop tap, close button, or hardware back button.
- Non-functional:
  - Minimum 44x44pt touch target on all pills and modal buttons (`hitSlop={8}`).
  - WCAG 2.1 AA contrast compliance using Expyrico design tokens (`#4BAE8A` Fresh Sage, `#3A8F6F` Deep Sage, `#2C2C28` Almost Black, `#FAFAF8` Warm White).
  - Proper accessibility roles (`accessibilityRole="button"`, `accessibilityState={{ selected: isSelected }}`).

## Architecture
```
┌────────────────────────────────────────────────────────────────────────┐
│                        LocationSelector Component                      │
│                                                                        │
│  [ Fridge ]    [ Freezer ]    [ Pantry ]    [ Counter ]   [ More ▾ ]   │
│     (1)            (2)           (3)            (4)           (5)      │
└────────────────────────────────────────────────────────────┬───────────┘
                                                             │ On press
                                                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        LocationPickerModal                             │
│                                                                        │
│  Storage Location                                                  ✕   │
│  Select where this item is stored in your home.                        │
│                                                                        │
│  ┌───────────────────────────────────────────────────────┬──────────┐  │
│  │ 🔍 Search or enter custom location...                 │  Apply   │  │
│  └───────────────────────────────────────────────────────┴──────────┘  │
│                                                                        │
│  COMMON LOCATIONS                                                      │
│  [Spice Rack]  [Cupboard]  [Cabinet]  [Basement]  [Cellar]             │
│  [Wine Cooler] [Drawer]    [Office]   [Garage]    [Bar]                │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ✕ Clear Location                                                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

## Related Code Files
- Create: `apps/mobile/src/components/LocationSelector.tsx`
- Create: `apps/mobile/src/components/LocationPickerModal.tsx`
- Create: `apps/mobile/src/utils/locations.ts`
- Create: `apps/mobile/tests/unit/location-selector.test.tsx`
- Create: `apps/mobile/tests/unit/location-picker-modal.test.tsx`

## Implementation Steps
1. **Constants & Utilities (`apps/mobile/src/utils/locations.ts`)**:
   - Define `DEFAULT_TOP_LOCATIONS = ['Fridge', 'Freezer', 'Pantry', 'Counter'] as const`.
   - Define `COMMON_OTHER_LOCATIONS = ['Spice Rack', 'Cupboard', 'Cabinet', 'Basement', 'Cellar', 'Wine Cooler', 'Drawer', 'Office', 'Garage', 'Bar'] as const`.
   - Helper `normalizeLocation(val?: string | null): string`: trims and normalizes casing for equality checks.

2. **LocationPickerModal Component (`apps/mobile/src/components/LocationPickerModal.tsx`)**:
   - Bottom sheet modal using React Native `Modal`, `KeyboardAvoidingView`, and theme styling.
   - Controlled search/custom input with auto-capitalization and "Apply" button.
   - Filtered chip grid combining matches from `COMMON_OTHER_LOCATIONS` and `DEFAULT_TOP_LOCATIONS`.
   - Prominent "Clear Location" button to deselect location (`onSelect(null)`).
   - Full keyboard accessibility and safe area handling (`useSafeAreaInsets`).

3. **LocationSelector Component (`apps/mobile/src/components/LocationSelector.tsx`)**:
   - Renders label (default: `"Location (optional)"`) and a single row of 5 pills (`flexDirection: 'row', gap: 6`).
   - Top 4 pills render with `DEFAULT_TOP_LOCATIONS`.
   - Active pill styles: `backgroundColor: theme.colors.primary`, `borderColor: theme.colors.primary`, `color: '#FFFFFF'`, `fontWeight: '700'`.
   - Inactive pill styles: `backgroundColor: theme.colors.bgGlass`, `borderColor: theme.colors.border`, `color: theme.colors.text`, `fontWeight: '600'`.
   - Tap handler: if current value matches pill, trigger `onChange(null)` (deselection); otherwise `onChange(location)`.
   - 5th pill displays `"More ▾"` or `"${value} ▾"` with `chevron-down` icon. If value is not in top 4, displays active style.
   - Tapping 5th pill toggles `modalVisible`.

4. **Unit Testing (`apps/mobile/tests/unit/`)**:
   - `location-selector.test.tsx`:
     - Renders 4 fixed pills and "More" pill.
     - Selecting "Fridge" calls `onChange('Fridge')`.
     - Tapping selected "Fridge" calls `onChange(null)` (deselection).
     - Passing custom location (e.g. "Spice Rack") displays "Spice Rack ▾" with active styling.
   - `location-picker-modal.test.tsx`:
     - Renders preset chips and custom input.
     - Typing custom location and clicking "Apply" calls `onSelect('Custom Name')`.
     - Clicking "Clear Location" calls `onSelect(null)`.

## Success Criteria
- [ ] `LocationSelector` renders 4 fixed pills + adaptive 5th pill on a single line.
- [ ] Tapping active pill cleanly deselects it.
- [ ] `LocationPickerModal` opens with keyboard-friendly text input and preset chips.
- [ ] Custom locations occupy the 5th pill in active Fresh Sage state.
- [ ] Touch targets are minimum 44x44pt; test suite passes with 100% assertion coverage.

## Risk Assessment
- *Risk*: Long custom location names overflow the 5th pill width on narrow screens.
- *Observable Signal*: Text wrapping or pushing the 5th pill out of the flex row.
- *Pre-decided Response*: Apply `numberOfLines={1}` with `ellipsizeMode="tail"` and flexible pill width styling matching `UnitSelector`'s `fifthPill` style.
