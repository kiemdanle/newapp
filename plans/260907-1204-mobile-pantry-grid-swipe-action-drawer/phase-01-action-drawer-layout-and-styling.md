---
phase: 1
title: "Action Drawer Layout and Styling"
status: completed
priority: P1
effort: "45m"
dependencies: []
---

# Phase 1: Action Drawer Layout and Styling

## Overview
Create the full-surface in-place `PantryGridActionDrawer` component that sits beneath or overlays the grid card, offering comfortable, full-width thumb targets for **+1 Quantity**, **Edit**, and **Delete**, styled strictly with Expyrico design tokens.

## Requirements
- Functional:
  - Header bar displaying truncated product name (`numberOfLines={1}`) and a close button `[✕]` (`accessibilityRole="button"`, `accessibilityLabel="Close action menu"`).
  - Action buttons: 3 tactile, vertically centered $48 \times 48\text{ pt}$ floating circular buttons with micro-labels below each:
    - **+1 Button**:
      - Circle: $48 \times 48\text{ pt}$, `backgroundColor: theme.colors.primary` (`#4BAE8A`), `borderRadius: theme.radii.full` (24px).
      - Icon: `Ionicons name="add" size={26} color="#FFFFFF"`.
      - Micro-label: `+1 Quantity` (11px, `color: theme.colors.textMuted`, bold).
      - `testID="record-add-quantity-{id}"`.
    - **Edit Button**:
      - Circle: $48 \times 48\text{ pt}$, `backgroundColor: theme.colors.accent` (`#F5A623`), `borderRadius: theme.radii.full` (24px).
      - Icon: `Ionicons name="create-outline" size={22} color="#FFFFFF"`.
      - Micro-label: `Edit` (11px, `color: theme.colors.textMuted`, bold).
      - `testID="record-edit-{id}"`.
    - **Delete Button**:
      - Circle: $48 \times 48\text{ pt}$, `backgroundColor: theme.colors.danger` (`#E0442A`), `borderRadius: theme.radii.full` (24px).
      - Icon: `Ionicons name="trash-outline" size={22} color="#FFFFFF"`.
      - Micro-label: `Delete` (11px, `color: theme.colors.textMuted`, bold).
      - `testID="record-delete-{id}"`.
  - Dismissal affordance:
    - Header close button `[✕]` (`testID="record-close-actions-{id}"`).
    - Scrolling the SectionList or executing any action safely dismisses the drawer.
    - The drawer interior uses `pointerEvents="box-none"` with generous spacing so only the circles and `[✕]` are interactive; no invisible background dismiss button to prevent accidental mis-taps.
<!-- Updated: Red Team Session 1 - Header dismiss & touch target padding -->
- Non-functional:
  - Exactly matches the outer dimensions, border radius (`16px`), border (`1px`), and background (`theme.colors.bgElevated`) of `PantryGridCard`.
  - Minimum touch target height of $40\text{–}44\text{ pt}$ for all action buttons.
  - 100% dynamic token resolution for Light (`expyrico`) and Dark (`expyricoDark`) modes.

## Architecture & Layout

```
┌──────────────────────────────────────────────┐
│ [ Organic Milk ]                         [✕] │  <- Dismiss Header (28pt)
├──────────────────────────────────────────────┤
│                                              │
│                   ( ➕ )                     │  <- 48x48pt Fresh Sage Circle
│                +1 Quantity                   │     Micro-label (11px)
│                                              │
│                   ( ✏️ )                     │  <- 48x48pt Honey Circle
│                    Edit                      │     Micro-label (11px)
│                                              │
│                   ( 🗑️ )                     │  <- 48x48pt Alert Red Circle
│                   Delete                     │     Micro-label (11px)
│                                              │
└──────────────────────────────────────────────┘
```

## Related Code Files
- Create: `apps/mobile/src/features/records/PantryGridActionDrawer.tsx`
- Create: `apps/mobile/src/features/records/PantryGridActionDrawer.test.tsx`

## Implementation Steps
1. **Component Interface**:
   ```typescript
   export interface PantryGridActionDrawerProps {
     record: LocalRecord;
     onAddQuantity?: (record: LocalRecord) => void;
     onEdit?: (record: LocalRecord) => void;
     onDelete?: (record: LocalRecord) => void;
     onClose: () => void;
   }
   ```
2. **Implement Layout**:
   - Use `flex: 1, padding: 10, justifyContent: 'space-between', borderRadius: 16, backgroundColor: theme.colors.bgElevated, borderWidth: 1, borderColor: theme.colors.border`.
   - Render header row with truncated title and `[✕]` icon.
   - Render 3 full-width action buttons stacked vertically with $8\text{ pt}$ gap.
3. **Unit Tests**:
   - Verify all 3 action buttons render with correct testIDs, icons, and text labels.
   - Verify tapping `+1` calls `onAddQuantity(record)`.
   - Verify tapping `Edit` calls `onEdit(record)`.
   - Verify tapping `Delete` calls `onDelete(record)`.
   - Verify tapping `[✕]` calls `onClose()`.

## Success Criteria
- [x] `PantryGridActionDrawer` renders cleanly within the card footprint.
- [x] Action buttons have $\ge 40\text{ pt}$ touch heights and high contrast text.
- [x] Tapping each button invokes the corresponding callback with the `record`.
- [x] 100% unit test pass rate in `PantryGridActionDrawer.test.tsx`.

## Risk Assessment
- *Risk*: On small screens (e.g. 320pt width), card height might constrain 3 stacked 42pt buttons.
- *Mitigation*: The grid card min-height is ~260–280pt, leaving plenty of vertical room for header (28pt) + 3 buttons (3 × 42pt = 126pt) + gaps (3 × 8pt = 24pt) = 178pt total, well below the available height.
