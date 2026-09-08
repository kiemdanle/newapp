---
title: "Mobile Pantry Quick Edit Brand Architecture"
description: "Enable pantry users to view and edit the Brand field directly in QuickEditModal below Item Name, with full persistence across WatermelonDB, sync, backend Prisma schema, and pantry display cards."
status: in-progress
priority: P1
effort: "4h"
tags: [pantry, quick-edit, mobile, watermelon-db, prisma, sync, brand]
created: 2026-09-08
---

# Mobile Pantry Quick Edit Brand Architecture

## Overview

In the Expyrico mobile pantry, users can quick-edit a record's name, category, quantity, unit, location, and expiry date via `QuickEditModal`. However, the **Brand** field was not editable in quick edit: catalog products displayed a read-only brand from the catalog, while custom items (without a barcode or catalog product) had no brand affordance at all.

This plan adds the ability for users to view, input, and edit the **Brand** directly in `QuickEditModal`, positioned immediately below the **Item Name** input. The brand is persisted locally in WatermelonDB `records`, synchronized with the backend `Record` table via Prisma, pre-populated gracefully from `record.brand || product?.brand`, and displayed dynamically across all pantry card views (`RecordCard`, `PantryGridCard`, `UseNextHero`, `PantrySelectModal`, and `record/[id].tsx`).

```
┌────────────────────────────────────────────────────────┐
│ QuickEditModal                                         │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Item Name: [ Fresh Milk                          ] │ │
│ └────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Brand:     [ TH True Milk                        ] │ │ ◄── NEW: Placed below Item Name
│ └────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Category:  [ Dairy                               ] │ │
│ └────────────────────────────────────────────────────┘ │
│   [Quantity / Unit / Location / Expiry Date]           │
└────────────────────────────────────────────────────────┘
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
WatermelonDB `records.brand`          Prisma `Record.brand`
(v5 → v6 Migration)                   (PostgreSQL Column)
       │                                       │
       └───────────────────┬───────────────────┘
                           ▼
Display: `record.brand || product?.brand`
(RecordCard, PantryGridCard, UseNextHero, PantryDetail)
```

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Position a responsive `Brand` field directly below `Item Name` in `QuickEditModal` with pre-population from `record.brand \|\| product?.brand` and asynchronous fallback. | P1 |
| 2 | Persist `brand` in local WatermelonDB `records` via schema v6 migration, `RecordModel`, and `LocalRecord` CRUD operations. | P1 |
| 3 | Extend shared record schemas (`recordSchema`, `recordCreateSchema`, `recordPatchSchema`) and Prisma backend `Record` model to store and sync `brand`. | P1 |
| 4 | Ensure all pantry display surfaces (`RecordCard`, `PantryGridCard`, `UseNextHero`, `PantrySelectModal`, `record/[id].tsx`) prioritize `record.brand \|\| product?.brand`. | P1 |
| 5 | Include `record.brand` in pantry search query matching (`filterAndSortRecords.ts`) so searching by brand immediately finds updated items. | P1 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: Shared Schema & API Support](./phase-01-shared-schema-and-api-support.md) | Pending |
| 2 | [Phase 2: Local Database Persistence](./phase-02-local-database-persistence.md) | Pending |
| 3 | [Phase 3: QuickEditModal UI & State Wiring](./phase-03-quick-edit-modal-ui-and-state.md) | Pending |
| 4 | [Phase 4: Pantry Cards, Search & Callers](./phase-04-pantry-cards-search-and-callers.md) | Pending |
| 5 | [Phase 5: Automated Testing & Device Verification](./phase-05-testing-and-device-verification.md) | Pending |

## Architecture & Data Flow

### 1. Precedence Contract
Following the exact precedent established for `customName` and `category`:
- **Display Name**: `record.customName || product?.name || 'Item'`
- **Brand**: `record.brand || product?.brand || null`
- **Category**: `record.category || product?.category || null`

When a user edits the brand in `QuickEditModal`, `record.brand` is updated. For custom items (no `productId`), this gives them a proper brand attribute. For catalog items, this allows the user to correct or localize the brand without modifying the global product catalog.

### 2. Synchronization Flow
- Local update: `patchLocalRecord(id, { brand: trimmedBrand })` sets `r.brand` and marks `r.pendingSync = true`.
- Network push: `pushPending()` in `sync.ts` includes `brand: rec.brand` in `POST /records` (for new records) and `PATCH /records/:id` (for existing records).
- Backend patch: `patchRecordRoute` validates `brand` via `recordPatchSchema` and writes `brand` to Prisma `record.update`.
- Pull sync: `toApiRecord` maps `r.brand` into the sync batch, and mobile `pullSince()` persists it into WatermelonDB.

## Success Criteria

- [ ] `QuickEditModal` renders `TextField` for Brand placed directly below `Item Name`.
- [ ] Brand input auto-populates with `record.brand || product?.brand` upon modal opening, and handles asynchronous product loading if the product was not yet cached.
- [ ] Saving updates `record.brand` via `patchLocalRecord` or `createLocalRecord` (in duplicate flow).
- [ ] Local WatermelonDB schema cleanly migrates from version 5 to 6 without data loss.
- [ ] Backend Prisma `Record` table stores `brand` and accepts it through `POST /records` and `PATCH /records/:id`.
- [ ] Pantry search matches on `record.brand`.
- [ ] Unit tests pass across `QuickEditModal.test.tsx`, `RecordCard.test.tsx`, `filterAndSortRecords.test.ts`, and backend integration tests.
- [ ] Verified on physical Android device with screenshot evidence showing the Brand field in `QuickEditModal`.

## Validation Log

### Session 1: Critical Decisions Interview (2026-09-08)

#### Questions & User Decisions
1. **Brand Override & Clear Behavior for Catalog Items**:
   - **Decision**: *Fallback to catalog brand when cleared*.
   - **Detail**: Consistent with `customName` and `category` patterns. `record.brand` overrides `product.brand`. If a user clears the field to empty, it saves `brand: null` locally on the record and falls back to displaying the catalog `product.brand`.
2. **Pantry Search Matching Scope**:
   - **Decision**: *Match record.brand || product.brand*.
   - **Detail**: In `filterAndSortRecords.ts:matchesPantryQuery`, the query checks `record.brand` first, and if unset, matches the catalog product's brand.
3. **Brand Field Labeling in QuickEditModal**:
   - **Decision**: *'Brand (optional)'*.
   - **Detail**: The field is labeled `"Brand (optional)"` to match `"Location (optional)"` and clearly communicate that brand is not required to save.

#### Verification Results
- Claims checked: 10
- Verified: 10 | Failed: 0 | Unverified: 0
- Tier: Full (all 5 phases fact-checked against schemas, models, routes, cards, and query engine)
- Failures: None

### Whole-Plan Consistency Sweep
- Zero unresolved contradictions across `plan.md` and `phase-*.md` files.
- Precedence rule `record.brand || product?.brand` consistently applied across local storage, display surfaces, and search matching.

## Red Team Review

### Session 1 — 2026-09-08
**Findings:** 5 (5 accepted, 0 rejected)
**Severity breakdown:** 1 Critical, 2 High, 2 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Schema allows zero-length strings instead of null (`packages/shared/src/schemas/record.ts:73`) | High | Accept | Phase 1 |
| 2 | Incomplete sync mapping in `pullSince` across 4 mutation branches (`apps/mobile/src/db/sync.ts:146-287`) | Critical | Accept | Phase 2 |
| 3 | Duplication flow drops brand on duplicated draft item (`apps/mobile/src/features/records/RecordList.tsx:427-442`) | High | Accept | Phase 4 |
| 4 | Async network race overwriting user-typed brand (`apps/mobile/src/features/records/QuickEditModal.tsx:82-89`) | Medium | Accept | Phase 3 |
| 5 | Newline injection from pasted text corrupts card layout (`apps/mobile/src/features/records/PantryGridCard.tsx:477-484`) | Medium | Accept | Phase 3 |

### Whole-Plan Consistency Sweep
- **Delta**: Enforced `.min(1)` on brand Zod schema; mapped `r.brand = ch.brand ?? null` across all 4 `pullSince` branches; ensured brand retention in `createLocalRecord` duplication path; added newline sanitization in `handleSave`; and guarded async catalog brand hydration with `userEditedBrandRef`.
- **Contradictions**: 0 unresolved contradictions across all phases.
