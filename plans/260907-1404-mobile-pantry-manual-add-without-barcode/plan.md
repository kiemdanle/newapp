---
title: "Mobile Pantry Manual Add Without Barcode (Produce, Bakery, Wet Market Items)"
description: "Allow users to add items without barcodes by introducing a dedicated 'Add without barcode' button on ScanScreen, camera permission bypass, and inline custom item entry in AddRecordForm."
status: pending
priority: P1
effort: "10h"
tags: ["mobile", "pantry", "scan", "forms", "ui-ux"]
created: 2026-09-07
---

# Mobile Pantry Manual Add Without Barcode (Produce, Bakery, Wet Market Items)

## Overview
Currently, pantry item creation in the mobile app requires scanning a barcode or QR code. Everyday household grocery items—such as fresh produce (apples, loose citrus, herbs, vegetables), wet market meats and fresh seafood, bakery breads and pastries, bulk dry goods, and prepared leftovers—do not have barcodes. When users attempt to add these items, they are trapped in the camera viewfinder with no affordance to proceed, or completely locked out if camera permissions were denied.

This plan implements a first-class manual addition capability:
1. A prominent, high-contrast `"Add without barcode"` floating action button on `ScanScreen` (`apps/mobile/app/(app)/scan.tsx`) anchored at the bottom of the camera viewfinder.
2. A camera-permission bypass in `CameraPermissionDeniedModal` and `PrePromptModal` allowing users without camera access to still add items manually.
3. An empty-pantry shortcut on the Home screen to jump directly into manual item entry.
4. An enhanced inline `AddRecordForm` that natively supports custom items without catalog IDs (`productId == null`), complete with an editable Item Name field, validation, and standard category quick-selection chips (`Produce`, `Dairy`, `Bakery`, `Meat & Seafood`, `Pantry`, `Frozen`, `Beverages`, `Snacks`, `Other`).
5. Comprehensive unit tests, Gradle Android build, and live physical device verification on Xiaomi MI 9.

## User Flow Diagram
```
[Home Tab (Pantry)]
       │
       ├──> [Central Action: "Scan an item"] ──────────────┐
       │                                                   ▼
       └──> [Empty Pantry Card: "Add without barcode"] ──> [ScanScreen]
                                                               │
                     ┌─────────────────────────────────────────┴─────────────────────────────────────────┐
                     ▼                                                                                   ▼
             [Camera Granted]                                                                    [Camera Denied]
                     │                                                                                   │
            [Camera Viewfinder]                                                             [Permission Denied Modal]
                     │                                                                                   │
        ┌────────────┴────────────┐                                                                      │
        ▼                         ▼                                                                      ▼
 [Scan Barcode]        [Pill: "Add without barcode"]                                        [Btn: "Add without barcode"]
        │                         │                                                                      │
        ▼                         └────────────────────────────────┬─────────────────────────────────────┘
  (Lookup flow)                                                    │
                                                                   ▼
                                                    [ui.phase = 'manual-entry']
                                                                   │
                                                                   ▼
                                                          [AddRecordForm]
                                                    - Item Name * (autofocused)
                                                    - Category chips (Produce, Bakery, Meat...)
                                                    - Expiry Date (Wheel picker / OCR)
                                                    - Quantity & UnitSelector
                                                    - Photo picker (optional)
                                                    - Price, store, notes (accordion)
                                                    - Scope selector (Personal / Household)
                                                                   │
                                                                   ▼
                                                         [Save to Pantry]
                                                                   │
                                                                   ▼
                                                        [createLocalRecord]
                                                                   │
                                                                   ▼
                                                      [Return to Pantry Tab]
                                                    Item appears in active list!
```

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Enable users to add non-barcode items (produce, bakery, wet market meats/fish) directly without scanning | P1 |
| 2 | Add an accessible floating `"Add without barcode"` CTA button to the `ScanScreen` viewfinder | P1 |
| 3 | Provide manual entry fallback in `CameraPermissionDeniedModal` and `PrePromptModal` so camera-less users can add items | P1 |
| 4 | Support editable item name input and standard category chips in `AddRecordForm` for custom items | P1 |
| 5 | Verify automated Jest test suites, compile Android debug APK via Gradle, and verify live on Xiaomi MI 9 | P1 |

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | [Phase 1: AddRecordForm Custom Item Support & Category Chips](./phase-01-add-record-form-custom-items.md) | Pending | 3h |
| 2 | [Phase 2: Scan UI Affordances, Permission Bypass & Navigation](./phase-02-scan-ui-affordances-and-permission-bypass.md) | Pending | 4h |
| 3 | [Phase 3: Testing Build and Device Verification](./phase-03-testing-build-and-device-verification.md) | Pending | 3h |

## Success Criteria

- [ ] Users can tap `"Add without barcode"` from the `ScanScreen` viewfinder and immediately enter item details.
- [ ] Users with denied camera permissions are offered `"Add item without barcode"` and can enter items without camera access.
- [ ] `AddRecordForm` renders an editable Item Name field when `productId` is null and validates that the name is non-empty.
- [ ] `STANDARD_CATEGORIES` chips (`Produce`, `Dairy`, `Bakery`, `Meat & Seafood`, `Pantry`, etc.) provide 1-tap categorization.
- [ ] Non-barcode items are persisted into WatermelonDB and appear in the Pantry list under their selected category and expiry date.
- [ ] Existing barcode scanning and catalog product lookup behaviors remain 100% operational with zero regressions.
- [ ] All unit tests pass (`pnpm --filter mobile test`) and typecheck passes with 0 errors (`pnpm --filter mobile typecheck`).
- [ ] Android debug APK is built via Gradle and verified live on Xiaomi MI 9 (`96d9c774`).

<!-- slug: mobile-pantry-manual-add-without-barcode -->
