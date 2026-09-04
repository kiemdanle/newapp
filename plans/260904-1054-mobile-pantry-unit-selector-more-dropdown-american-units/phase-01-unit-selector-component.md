---
phase: 1
title: "Unit Architecture, Admin Configuration, and Reusable UnitSelector Component"
status: done
priority: P1
effort: "4-5h"
dependencies: []
---

# Phase 1: Unit Architecture, Admin Configuration, and Reusable UnitSelector Component

## Overview
Establish the comprehensive grocery unit system across backend, admin, and mobile. Provide an Admin Dashboard configuration (`/settings/pantry-units`) where platform operators can configure which 4 units are pinned as the primary fast pills (defaulting to `pcs`, `pack`, `can`, `bottle`). Build the reusable React Native `UnitSelector` component featuring these top 4 pills plus an adaptive 5th "More ▾" pill that opens a categorized picker sheet (including American imports: `oz`, `lb`, `fl oz`, `gal`, `pt`, `qt`, metric units, container types, and custom text entry).

## Requirements

### Functional
- **Admin Dashboard Configuration (`/settings/pantry-units`)**:
  <!-- Updated: Red Team Review - Distinctness validation & requireAdmin -->
  - `pantryUnitsSettingsSchema` in `@expyrico/shared`: validates `topUnits: z.array(z.string().trim().min(1).max(16).regex(/^[a-zA-Z0-9\s/°\-_.]+$/, 'Invalid unit characters')).length(4).refine((units) => new Set(units.map((u) => u.toLowerCase())).size === 4, 'Top units must be distinct')`.
  - Backend endpoints:
    - `GET /v1/admin/settings/pantry-units`: Operator views top 4 units.
    - `PATCH /v1/admin/settings/pantry-units`: Operator updates top 4 units with `app.requireAdmin` and audit logging (`settings.pantry_units.update`).
    - `GET /v1/settings/pantry-units`: Client-accessible public endpoint returning the active top 4 units setting.
  - Admin web UI under `apps/admin/src/app/(admin)/settings/pantry-units/`:
    - Form allowing selection, re-ordering, and typing of the 4 default pills.
- **Top 4 Fast-Access Pills (Mobile)**:
  <!-- Updated: Red Team Review - Offline-first AsyncStorage cache & case-insensitive matching -->
  - Dynamically loaded from `usePantryUnitSettings()`, cached in local `AsyncStorage` (`@expyrico_pantry_top_units`), falling back to `['pcs', 'pack', 'can', 'bottle']` for instant zero-flicker offline rendering.
  - Direct 1-tap selection for the 4 primary units.
- **Adaptive 5th Pill ("More ▾")**:
  - Displays `"More ▾"` when one of the top 4 units is selected (matched case-insensitively).
  - Displays `"${activeUnit} ▾"` (e.g. `[ oz ▾ ]` or `[ kg ▾ ]`) highlighted in active Fresh Sage when a unit from the sheet is active.
  - Tapping opens the `UnitPickerModal` sheet.
- **Categorized 'More' Sheet (`UnitPickerModal`)**:
  - **Packaged & Containers**: `box`, `bag`, `jar`, `carton`, `tub`, `bunch`, `bar`, `roll`
  - **Metric Units**: `kg`, `g`, `l`, `ml`
  - **US Customary / American Imports**:
    - Weight: `oz` (ounce), `lb` (pound)
    - Volume: `fl oz` (fluid ounce), `pt` (pint), `qt` (quart), `gal` (gallon)
  - **Custom Unit Input**:
    <!-- Updated: Red Team Review - Input sanitization & control character protection -->
    - Freeform text input validated against `/^[a-zA-Z0-9\s/°\-_.]+$/` (max 16 chars) with `"Apply"` button for specialized units (e.g. `trái`, `củ`, `lon`, `hộp`).
  - Search filter bar allowing users to type (e.g. "oz") to immediately highlight matching units.
  - **Android Hardware Back Protection**:
    <!-- Updated: Red Team Review - Nested modal back-press trap prevention -->
    - `UnitPickerModal` isolates `onRequestClose` to dismiss only the unit sheet, preventing the parent `QuickEditModal` or form from accidentally closing and discarding user input.
  - Touch targets >= 44×44pt per `ak:ui-ux-pro-max`.

## Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Admin Dashboard / Settings                      │
│                                                                        │
│  Operator configures: [ pcs ] [ pack ] [ can ] [ bottle ]             │
│         │                                                              │
│         ▼                                                              │
│  PATCH /v1/admin/settings/pantry-units                                 │
│  Prisma 'settings' table: key = 'pantry_units'                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ GET /v1/settings/pantry-units
┌────────────────────────────────────────────────────────────────────────┐
│                        UnitSelector (Mobile App)                       │
│                                                                        │
│  [ pcs ]    [ pack ]    [ can ]    [ bottle ]    [ More ▾ / oz ▾ ]    │
│    (1)        (2)         (3)         (4)             (5)              │
└────────────────────────────────────────────────────────┬───────────────┘
                                                         │ Tap on (5)
                                                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        UnitPickerModal Sheet                           │
│                                                                        │
│  🔍 Search units (oz, fl oz, lb)...                                    │
│                                                                        │
│  PACKAGED & CONTAINERS                                                 │
│  [box] [bag] [jar] [carton] [tub] [bunch] [bar] [roll]                 │
│                                                                        │
│  METRIC SYSTEM                                                         │
│  [kg] [g] [l] [ml]                                                     │
│                                                                        │
│  AMERICAN IMPORTS (US CUSTOMARY)                                       │
│  [oz (weight)] [lb (pound)] [fl oz (volume)] [pt] [qt] [gal]           │
│                                                                        │
│  CUSTOM UNIT                                                           │
│  [ Type custom unit...           ]  [ Apply ]                          │
└────────────────────────────────────────────────────────────────────────┘
```

## Related Code Files

### Create
- `packages/shared/src/schemas/admin/settings.ts` (or expand) — Add `pantryUnitsSettingsSchema`.
- `api/src/routes/admin/settings/pantry-units.ts` — Admin GET/PATCH endpoints for top 4 units.
- `api/src/routes/settings/pantry-units.ts` — Client-accessible public endpoint for top 4 units.
- `api/tests/integration/admin-pantry-units-settings.test.ts` — Integration tests for admin settings route.
- `apps/admin/src/app/(admin)/settings/pantry-units/page.tsx` — Admin Dashboard settings page.
- `apps/mobile/src/components/UnitSelector.tsx` — Reusable 5-pill unit selector.
- `apps/mobile/src/components/UnitPickerModal.tsx` — Categorized sheet for metric, packaging, and American imports.
- `apps/mobile/src/utils/units.ts` — Unit definitions, categories, and helpers.
- `apps/mobile/tests/unit/unit-selector.test.tsx` — Unit tests.

## Implementation Steps

1. **Shared Schema (`packages/shared`)**:
   - Define `pantryUnitsSettingsSchema`:
     ```typescript
     export const pantryUnitsSettingsSchema = z.object({
       topUnits: z.array(z.string().trim().min(1).max(16)).length(4).default(['pcs', 'pack', 'can', 'bottle']),
     });
     export type PantryUnitsSettings = z.infer<typeof pantryUnitsSettingsSchema>;
     ```
   - Rebuild shared package and sync to vendored dist.

2. **Backend Endpoints (`api/src/routes/admin/settings/` & `api/src/routes/`)**:
   - Add `SETTING_KEYS.PANTRY_UNITS = 'pantry_units'`.
   - Register admin routes under `/v1/admin/settings/pantry-units`.
   - Register client route `GET /v1/settings/pantry-units`.

3. **Admin Dashboard Page (`apps/admin`)**:
   - Create settings page allowing operators to view and update the 4 primary units.

4. **Mobile Components (`UnitSelector.tsx`, `UnitPickerModal.tsx`, `units.ts`)**:
   - Implement `UnitSelector` with adaptive 5th slot.
   - Implement `UnitPickerModal` with American imports and custom text input.

5. **Automated Unit & Integration Tests**:
   - Backend integration tests verifying setting get, patch, and audit log.
   - Mobile unit tests verifying top-4 pill selection, "More" expansion, and American unit selection.

## Success Criteria
- [x] Admin can configure the 4 default top units in Admin Dashboard with audit logging.
- [x] Client fetches top 4 units dynamically, falling back to `['pcs', 'pack', 'can', 'bottle']`.
- [x] Mobile row compressed from 10 buttons (2 lines) to 5 buttons (1 clean line).
- [x] 5th pill dynamically shows `"More ▾"` or the active custom/imported unit.
- [x] Modal sheet includes American imports (`oz`, `lb`, `fl oz`, `gal`, `pt`, `qt`).
- [x] Modal includes custom unit text input for specialized items.
- [x] 100% automated test coverage in API and mobile test suites.

## Risk Assessment
- **Risk**: Backend offline or unseeded `pantry_units` setting.
- **Observable Signal**: Network failure on `GET /v1/settings/pantry-units`.
- **Mitigation**: `UnitSelector` falls back to `['pcs', 'pack', 'can', 'bottle']` locally with zero UI disruption.
