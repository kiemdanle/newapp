---
title: "Mobile Creator Product Drafts and Fast Pantry Add"
description: "Unify unapproved drafts and approved creator products in 'My Product Drafts' with status filters and one-tap pantry addition"
status: pending
priority: P1
effort: "6h"
tags: ["mobile", "api", "shared", "products", "pantry", "drafts"]
created: 2026-09-09
---

# Mobile Creator Product Drafts and Fast Pantry Add

## Overview

Currently, when a user creates and submits a product draft, it "vanishes" from the "My Product Drafts" screen the moment it is approved and marked `active`. This creates confusion and breaks the user's mental model, where pre-added products should serve as quick-add templates for future pantry stocking.

This plan expands the creator product drafts system across `@expyrico/shared`, the backend Fastify API, and the React Native mobile app so that:
1. All products created by the user—whether `draft`, `pending`, `changes_required`, or `active`—remain permanently accessible in "My Product Drafts" (or "My Products").
2. The mobile screen provides clean filter tabs (`All`, `Active`, `In review`, `Drafts`) to manage the catalog as it grows.
3. Users can tap any approved (`active`) or in-review (`pending`) product to open an immediate **Add to Pantry** sheet, allowing them to stock their pantry in 3 seconds with pre-filled metadata and expiration date tracking.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Expand `@expyrico/shared` schemas to permit `active` status in creator draft rows and queries | P1 |
| 2 | Update backend Fastify API `listDrafts` service to return creator's `active` products and serialize public thumbnails | P1 |
| 3 | Add interactive status filter tabs (`All`, `Active`, `In review`, `Drafts`) to mobile `ProductDraftsScreen` | P1 |
| 4 | Implement one-tap "+ Add to pantry" action on active/pending product rows with scope protection | P1 |
| 5 | Verify with automated unit/integration tests and live device installation via ADB | P1 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: Shared Schema and API Creator Products Listing](./phase-01-start.md) | Pending |
| 2 | [Phase 2: Mobile Filter Tabs and Status Styling](./phase-02-mobile-filter-tabs-and-status-styling.md) | Pending |
| 3 | [Phase 3: Fast Add To Pantry Flow and Form](./phase-03-fast-add-to-pantry-flow-and-form.md) | Pending |
| 4 | [Phase 4: Testing Verification and Device Build](./phase-04-testing-verification-and-device-build.md) | Pending |

## Architecture & Data Flow

```
[User on Mobile]
       │
       ▼
[ProductDraftsScreen] ──(Filters: All | Active | In review | Drafts)
       │
       ├─── GET /v1/products/drafts?status=...
       │         │
       │         ▼
       │    [Fastify API: listDrafts]
       │         │
       │         ▼
       │    [Prisma: Product.findMany where createdByUserId = actorId]
       │         │ (Includes status: draft, pending, changes_required, active)
       │         ▼
       │    [Returns ProductDraftsPage with ProductDraftRow[]]
       │
       ▼
 [Tap "Add to Pantry"]
       │
       ├── Active Product ───► AddRecordForm (Personal or Household scope)
       │                              │
       │                              ▼
       │                     POST /v1/records (Pantry item created)
       │
       ├── Pending Product ──► AddRecordForm (lockedPersonalScope: true)
       │                              │
       │                              ▼
       │                     POST /v1/records (Pantry item created in Personal scope)
       │
       └── Draft / Changes ──► ProductNew Editor (Finish & submit catalog details)
```

## Success Criteria

- [ ] `GET /v1/products/drafts` returns the user's `active` products alongside unsubmitted and pending drafts.
- [ ] Active products properly resolve thumbnail URLs for public CDN storage.
- [ ] Mobile `ProductDraftsScreen` displays filter tabs: `All`, `Active`, `In review`, `Drafts`.
- [ ] Status badges match Expyrico design guidelines: Fresh Sage `#4BAE8A` for Active, Honey `#F5A623` for Pending, Pebble `#8C8C85` for Draft, Alert Red `#E0442A` for Changes Required.
- [ ] Tapping "+ Add to pantry" or an active/pending row opens the pantry creation dialog pre-filled with product name and category.
- [ ] Pending products strictly enforce personal scope; active products allow household scope selection.
- [ ] All unit and integration tests pass across `packages/shared`, `api`, and `apps/mobile`.
- [ ] Debug APK builds cleanly and installs via ADB on the connected Xiaomi MI 9 device.


## Validation Log

### Session 1 — 2026-09-09
**Trigger:** Plan validation interview (/ak:plan validate)
**Questions asked:** 3

#### Verification Results
- Claims checked: 6
- Verified: 6 | Failed: 0 | Unverified: 0
- Tier: Standard
- All checked files, schemas, endpoints, and component props match codebase contracts.

#### Questions & Answers

1. **[Architecture / UX]** When you tap an Approved or In-Review product in the list, how should it behave?
   - Options: Open Add to Pantry modal directly (Recommended) | Inline '+ Add' button + tap row for details | Show Action Sheet (Add or Details)
   - **Answer:** Show Action Sheet (Add or Details)
   - **Rationale:** Gives the user a clean fork: either immediately stock the item to pantry or inspect/edit product details, preventing accidental modal triggers while keeping fast-add one tap away.

2. **[Scope / UI Naming]** What should this screen be named across the app?
   - Options: Rename to 'My Products' (Recommended) | Keep 'My Product Drafts'
   - **Answer:** Keep 'My Product Drafts'
   - **Rationale:** Preserves existing route naming and user recognition, with updated subtitle ("Products you've contributed or are drafting for catalog") clarifying that approved items remain listed.

3. **[Pantry Defaults]** How should the expiration date be initialized when adding an item to your pantry?
   - Options: Shelf life + quick preset chips (+3d, +1w, +2w, +1m) (Recommended) | Empty date (require manual pick)
   - **Answer:** Shelf life + quick preset chips (+3d, +1w, +1m, +3m)
   - **Rationale:** Initializes expiration based on product default shelf life if present (or +1 week fallback) and presents quick tap chips (+3d, +1w, +1m, +3m) for 2-second stocking.

#### Confirmed Decisions
- **Action Sheet Affordance**: Tapping an active/pending row shows an ActionSheet/Alert with "Add to Pantry" and "View Product Details" (plus inline "+ Add" button on row).
- **Naming Kept**: Retain "My product drafts" title on screen and Profile tab.
- **Date Chips**: Implement +3d, +1w, +1m, +3m preset chips in the pantry add flow.

#### Action Items
- [ ] Phase 2: Update subtitle in `ProductDraftsScreen` to reflect both drafts and active products.
- [ ] Phase 3: Implement ActionSheet on row tap and preset chips (+3d, +1w, +1m, +3m) in Add to Pantry flow.

#### Impact on Phases
- Phase 2: Preserves "My product drafts" title; updates subtitle; styles status badges.
- Phase 3: Implements Action Sheet on row press and adds preset date chips (+3d, +1w, +1m, +3m).

### Whole-Plan Consistency Sweep
- Zero unresolved contradictions.
- All 4 phases aligned with confirmed decisions.

## Red Team Review

### Session 1 — 2026-09-09
**Reviewers:** Security Adversary, Failure Mode Analyst, Assumption Destroyer
**Findings:** 5 accepted, 0 rejected
**Severity breakdown:** 1 Critical, 2 High, 2 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Debounce / multi-tap guard on "+ Add" button to prevent duplicate records | High | Accept | Phase 3 |
| 2 | Form state reset across product selections (`key={selectedPantryProduct.id}`) | Medium | Accept | Phase 3 |
| 3 | Graceful fallback icon/placeholder for active products with null covers | Medium | Accept | Phase 2 |
| 4 | Strict creator-only isolation in `listDrafts` (`createdByUserId: actorId`) | Critical | Accept | Phase 1 |
| 5 | Dual-layer `lockedPersonalScope` enforcement for pending items (UI + backend) | High | Accept | Phase 3 |

### Whole-Plan Consistency Sweep
- Converted all 5 accepted findings into decision deltas.
- Reconciled all 4 phase files with applied markers.
- Zero unresolved contradictions across the whole plan.
<!-- slug: mobile-creator-products-pantry-add -->
