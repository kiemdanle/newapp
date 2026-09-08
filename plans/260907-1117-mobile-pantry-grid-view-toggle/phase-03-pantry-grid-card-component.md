---
phase: 3
title: "Pantry Grid Card Component"
status: completed
priority: P1
effort: "1h"
dependencies: ["phase-01-ui-preferences-view-mode-store"]
---

# Phase 3: Pantry Grid Card Component

## Overview
Create `PantryGridCard.tsx` to display pantry records in a vertical, 2-column grid layout with a prominent product thumbnail, quantity/expiry badge, brand, 2-line title, sharing badge, and selection-mode checkbox.

## Requirements
- Functional:
  - Render product image thumbnail using `ProductThumbnail` (size 72) centered in a padded visual container.
  - Render quantity and expiry traffic-light pill (`red`, `amber`, `green`) in the top-right corner.
  - Display brand name (or category fallback) in uppercase muted typography using `theme.typeRamp.labelSmall` (11px).
  - Display custom/product name truncated to maximum 2 lines (`numberOfLines={2}`).
  - Replicate RecordCard's exact household classifier: `isHouseholdItem = Boolean(record.householdId)`, `badgeLabel = householdName || 'Shared'`. Personal badge is only rendered when `scope === 'all' && !record.householdId`. Missing household name must fall back to `'Shared'`, never `'Personal'`.
  - Privacy field allowlist: grid card displays only thumbnail, status, brand/category, name, badge, and expiry. Do NOT render notes, price, or store.
<!-- Updated: Red Team Session 1 - Household badge gate & privacy allowlist -->
  - Display formatted relative expiry date (`getRelativeExpiryLabel` or `formatDate`). Footer metadata row wraps with `flexWrap: 'wrap'` or stacked layout to prevent clipping on 360pt screens.
<!-- Updated: Red Team Session 1 - Responsive metadata wrap for 360pt screens -->
  - Tap behavior: in standard mode, tap opens detail (`onPress(record.id)`). In `selectionMode === true`, tap toggles selection (`onToggleSelect(record.id)`).
  - Support long-press (`delayLongPress={300}`) to trigger selection mode ONLY when not already selecting: `if (!selectionMode) onLongPress?.(record.id)`.
<!-- Updated: Red Team Session 1 - Swipe non-goal & selection mode guard -->
  - When `selectionMode === true`, render an accessible selection checkbox in the top-left corner with `theme.colors.neutralMid` unselected outline and `theme.colors.primary` selected fill.
<!-- Updated: Validation Session 1 - Balanced Grocery Card (72pt) & Top-Left Checkbox confirmed -->
- Non-functional:
  - Follow Expyrico colour palette dynamically via `theme.colors.*` (zero hardcoded light hex) to guarantee full support for both `expyrico` (Light) and `expyricoDark` (Dark) themes.
<!-- Updated: Red Team Session 1 - Expyrico dark tokens & canonical test titles -->
  - No clipping artifacts: do NOT put `overflow: 'hidden'` with mismatched radius on the card container; allow elevation shadow to render smoothly.
  - Non-goal: Grid cards do not have horizontal swipe actions (+1, Edit, Delete); users use detail screen or bulk actions.
  - Accessible touch feedback (`opacity: pressed ? 0.88 : 1`).

## Architecture & Layout

```
┌──────────────────────────────────────────────┐
│  [🔘 Select]                 [Qty · Expiry]  │  <- Top Row
│                                              │
│             ┌──────────────┐                 │
│             │  Product     │                 │  <- Visual Container
│             │  Thumbnail   │                 │     (size: 72)
│             └──────────────┘                 │
│                                              │
│  BRAND / CATEGORY                            │  <- Muted Uppercase
│  Organic Whole Milk...                       │  <- Name (max 2 lines)
│                                              │
│  [👥 Dân house]   Expires in 3 days          │  <- Badge & Expiry Row
└──────────────────────────────────────────────┘
```

## Related Code Files
- Create: `apps/mobile/src/features/records/PantryGridCard.tsx`
- Create: `apps/mobile/src/features/records/PantryGridCard.test.tsx`

## Implementation Steps
1. **Create Component Shell**:
   In `apps/mobile/src/features/records/PantryGridCard.tsx`, define:
   ```typescript
   export interface PantryGridCardProps {
     record: LocalRecord;
     householdName?: string | null;
     onPress: (id: string) => void;
     onLongPress?: (id: string) => void;
     selectionMode?: boolean;
     isSelected?: boolean;
     onToggleSelect?: (id: string) => void;
   }
   ```
2. **Implement Card Visuals**:
   - Wrap in `<Pressable>` with `delayLongPress={300}`.
   - Use `theme.colors.bgElevated`, `borderRadius: theme.radii.md`, `borderWidth: 1`, `borderColor: theme.colors.border`, and soft elevation (`elevation: 1, shadowColor: theme.colors.neutralDark, shadowOpacity: 0.05, shadowRadius: 8`).
   - Center `<ProductThumbnail>` with size 72 inside an inner rounded preview box (`borderRadius: theme.radii.sm`, `backgroundColor: theme.colors.bgGlass`).
   - Top badges: Selection checkbox (`Ionicons` checkmark-circle or ellipse-outline with `theme.colors.neutralMid`) on left; status pill on right.
   - Information block: Brand, displayName, household/personal pill, and relative expiration date.
3. **Unit Tests**:
   Write `PantryGridCard.test.tsx` verifying:
   - Renders product name, brand, and quantity.
   - Tapping invokes `onPress(record.id)`.
   - Long-pressing invokes `onLongPress(record.id)`.
   - Selection mode shows checkbox; tapping toggles select.

## Success Criteria
- [x] `PantryGridCard` renders cleanly with vertical orientation and proper Expyrico tokens.
- [x] Name truncates cleanly at 2 lines without overflowing.
- [x] Selection checkbox is visible ($3.24:1$ Pebble) and togglable.
- [x] Unit tests pass 100%.

## Risk Assessment
- *Risk*: Varying lengths of product names cause unequal card heights in the same grid row.
- *Mitigation*: Set `flex: 1` on each card and `numberOfLines={2}` with a fixed minimum text block height, ensuring consistent card heights across paired rows.
