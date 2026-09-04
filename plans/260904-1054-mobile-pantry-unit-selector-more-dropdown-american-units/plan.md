---
title: "Mobile Pantry Unit Selector: Top 4 Quick Pills, More Dropdown, and American Imports Support"
description: "Comprehensive implementation plan to replace the legacy 10-button wrap grid with an ergonomic 5-button row (top 4 most used units as pills + adaptive 'More ▾' dropdown) across pantry new item creation and quick editing, including full support for US customary / American import units (oz, lb, fl oz, etc.)."
status: done
priority: P1
effort: "1-2d"
tags: ["mobile", "pantry", "ui", "quick-edit", "units", "american-units", "touch-targets", "design-system"]
created: 2026-09-04
---

# Mobile Pantry Unit Selector: Top 4 Quick Pills, More Dropdown, and American Imports Support

## Overview

Upgrade grocery unit selection in the Expyrico mobile app across both pantry item editing (`QuickEditModal`) and new item creation (`AddRecordForm`). 

Currently, `QuickEditModal` displays a cluttered 2-row wrap grid of 10 static unit buttons (`pcs`, `pack`, `can`, `bottle`, `box`, `bag`, `kg`, `g`, `l`, `ml`), while `AddRecordForm` presents a bare text input. Furthermore, American grocery imports measured in US customary units (`oz`, `lb`, `fl oz`, `gal`, `pt`, `qt`) are not readily accessible.

This plan introduces a unified, space-efficient `UnitSelector` component:
1. **Top 4 Quick Pills**: The 4 most common grocery units (`pcs`, `pack`, `can`, `bottle`) are directly selectable in 1 tap.
2. **Adaptive 5th Slot ("More ▾")**: All other units (packaged containers, metric, and American imports) collapse into a clean "More ▾" dropdown sheet. When a unit from the sheet is chosen (e.g. `oz`), that unit occupies the 5th pill in the active state.
3. **50% Vertical Space Reduction**: Compresses the previous 10-button multi-line block into a single, predictable 5-button row, preventing modal action buttons from being pushed offscreen.
4. **American Customary Imports Support**: First-class support for `oz`, `lb`, `fl oz`, `pt`, `qt`, `gal` with full schema and sync compatibility.

---

## Problem Statement & Architectural Context

1. **Visual Clutter & Vertical Stacking**: In `QuickEditModal`, 10 pill buttons wrap across two lines. On smaller phone screens, this pushes the "Cancel" and "Save" buttons toward the bottom edge, crowding the viewport and increasing mis-taps.
2. **Inconsistent Creation Experience**: While `QuickEditModal` had buttons, `AddRecordForm` provided a freeform text input, forcing users to manually type units on mobile keyboards.
3. **Missing US Customary Units**: Users importing American items (e.g. 12 fl oz sodas, 16 oz pasta, 1 lb ground beef) had no fast way to select ounces, pounds, or fluid ounces.
4. **Database & Sync Readiness**: `@expyrico/shared` already supports `unit: z.string().trim().max(16)`, and WatermelonDB stores `unit` as a string. No database schema migration is required; the work is purely frontend UI component architecture and form unification.

---

## Goals & Acceptance Criteria

| # | Goal | Acceptance Criteria | Priority |
|---|------|---------------------|----------|
| 1 | **Ergonomic 5-Pill Row** | Compress unit selection from 10 buttons (2 lines) to 5 buttons (1 clean line). Top 4 pills (`pcs`, `pack`, `can`, `bottle` by default) selectable with 1 tap. | P1 |
| 2 | **Adaptive 5th "More ▾" Slot** | Displays `"More ▾"` when a top-4 unit is active; displays `"${unit} ▾"` (e.g. `[ oz ▾ ]`) highlighted in active Fresh Sage when a less common or American unit is selected. | P1 |
| 3 | **American Imports Support** | "More" sheet includes categorized US customary units: `oz` (ounce), `lb` (pound), `fl oz` (fluid ounce), `gal` (gallon), `pt` (pint), `qt` (quart). | P1 |
| 4 | **Admin Dashboard Configuration** | Platform operators can configure and reorder the 4 default top units in Admin Dashboard under `/settings/pantry-units`, persisted via `SETTING_KEYS.PANTRY_UNITS` with audit logging. | P1 |
| 5 | **Form Unification** | Reusable `UnitSelector` component integrated into both `QuickEditModal.tsx` and `AddRecordForm.tsx`. | P1 |
| 6 | **Custom Unit Fallback** | "More" sheet provides a custom unit text input with "Apply" button for unlisted or locale-specific units. | P2 |
| 7 | **On-Device & Test Verification** | 100% automated test coverage in Jest & Vitest; debug APK compiled via Gradle and verified live on connected Android device via `adb`. | P1 |
---

## Phases Roadmap

| # | Phase | File | Status | Priority | Effort |
|---|-------|------|--------|----------|--------|
| 1 | **Unit Architecture, Admin Configuration, and Reusable UnitSelector Component** | [phase-01-unit-selector-component.md](./phase-01-unit-selector-component.md) | done | P1 | 4-5h |
| 2 | **Form Integrations in QuickEditModal and AddRecordForm** | [phase-02-form-integrations.md](./phase-02-form-integrations.md) | done | P1 | 2-3h |
| 3 | **End-to-End Verification, APK Build, and Live Device Testing** | [phase-03-verification-and-apk.md](./phase-03-verification-and-apk.md) | done | P1 | 2-3h |

---

## Architecture & Component Design

```
┌────────────────────────────────────────────────────────────────────────┐
│                        UnitSelector Component                          │
│                                                                        │
│  [ pcs ]    [ pack ]    [ can ]    [ bottle ]    [ More ▾ / oz ▾ ]    │
│    (1)        (2)         (3)         (4)             (5)              │
└────────────────────────────────────────────────────────┬───────────────┘
                                                         │ Tap on (5)
                                                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        UnitPickerModal Sheet                           │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 🔍 Search unit (e.g. oz, fl oz, lb)...                           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
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

---

## Design System & Touch Target Discipline

Adheres strictly to `docs/design/expyrico-colour-palette.md` and `ak:ui-ux-pro-max`:
- **Colors**:
  - Active pill: Fresh Sage `#4BAE8A` with pure white text.
  - Inactive pill: Mint Mist `#D6F0E6` (light mode) or Elevated `#1B2621` (dark mode) with `#2C2C28` / `#FAFAF8` text.
  - Dividers & sheet border: Stone `#F0F0ED`.
  - Sheet background: Warm White `#FAFAF8` / Elevated surface.
- **Touch Target Minimums**: Each pill is sized >= 44×44pt to meet Apple HIG & Material touch standards, preventing mis-taps.
- **No Side-Stripe Borders**: Adheres to the absolute ban on side-stripes.

---

## Validation Log

### Verification Results
- Claims checked: 5
- Verified: 5 | Failed: 0 | Unverified: 0
- Tier: Standard
- Verified files:
  - `QuickEditModal.tsx`: Confirmed 10-button grid using local `COMMON_UNITS`.
  - `AddRecordForm.tsx`: Confirmed bare `TextInput` for unit.
  - `packages/shared/src/schemas/record.ts`: Confirmed `unit: z.string().trim().max(16)` supports American units without changes.
  - `api/prisma/schema.prisma`: Confirmed `unit String @default("pcs")` supports any string up to VARCHAR(16).
  - `apps/mobile/src/db/schema.ts`: Confirmed `RecordModel` stores `unit` as string.

### Interview Decisions
1. **Adaptive 5th Pill Behavior**: When a unit from the "More" sheet is selected (e.g. `oz` or `kg`), the 5th pill dynamically morphs to `[ ${unit} ▾ ]` in active Fresh Sage, preserving the 1-row, 5-pill layout with instant visual feedback.
2. **Top 4 Units Configurable via Admin Dashboard**: Rather than being permanently hardcoded, the 4 default units are configurable by operators in the Admin Dashboard (`/settings/pantry-units`) and fetched by clients via `GET /v1/settings/pantry-units`, defaulting to `['pcs', 'pack', 'can', 'bottle']`.
3. **Curated Categories + Custom Text Input**: The "More" sheet organizes units into Container/Packaging, Metric System, and American Imports (US Customary), plus a freeform text input with an "Apply" button for specialized or locale-specific units.

### Whole-Plan Consistency Sweep
- Zero unresolved contradictions across all phases.
- Phases updated to include Admin Dashboard settings, client endpoint, and reusable `UnitSelector` component.


## Red Team Review

### Session — 2026-09-04
**Findings:** 6 (6 accepted, 0 rejected)
**Severity breakdown:** 0 Critical, 3 High, 3 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Custom Unit XSS & Control Character Injection | High | Accept | Phase 1 |
| 2 | Unit Case Sensitivity & Normalization Mismatch (`oz` vs `OZ`) | High | Accept | Phase 1 & 2 |
| 3 | Offline Stalling on Admin Setting Query | High | Accept | Phase 1 |
| 4 | Android Hardware Back Nested Modal Dismissal Trap | Medium | Accept | Phase 1 & 2 |
| 5 | Admin Setting Validation Lacks Distinctness Guard | Medium | Accept | Phase 1 |
| 6 | Downstream VARCHAR(16) Buffer Clearance in Giveaways | Medium | Accept | Phase 2 |

### Post-Review Consistency Sweep
- Zero unresolved contradictions across all phases.
- Added strict regex sanitization `/^[a-zA-Z0-9\s/°\-_.]+$/` to custom unit input.
- Added distinctness refine to `pantryUnitsSettingsSchema`.
- Implemented offline AsyncStorage fallback for top units setting.
- Ensured nested modal dismissal isolation for Android hardware back button.
- Verified that `fl oz` (5 chars) and all US customary units safely clear VARCHAR(16) columns across records and giveaways.
---

<!-- slug: mobile-pantry-unit-selector-more-dropdown-american-units -->
