---
phase: 5
title: "Product Drafts Creation & UX Fixes"
status: pending
priority: P1
dependencies: ["phase-01-data-model-shared-schemas.md"]
---

# Phase 5: Product Drafts Creation & UX Fixes
<!-- Updated: Red Team Review - Client-side barcode format validation -->

## Overview
This phase diagnoses and resolves the missing product draft creation functionality in `ProductDraftsScreen`, adding intuitive entry points for scanning barcodes/QR codes and manually inputting codes to initiate new community catalog drafts with client-side format validation.

## Problem Diagnosis & Root Cause
In `apps/mobile/app/(app)/product/drafts.tsx`, the `ProductDraftsScreen` renders existing drafts and an empty state banner ("No drafts yet. Scan a barcode or QR code that isn't in the catalog yet to start one."). However:
1. **Missing Action Trigger**: There is no button, Floating Action Button (FAB), or header control to start adding a draft from this screen.
2. **Missing Manual Entry Route**: Users whose camera is unavailable or whose product barcode cannot be scanned had no manual code entry affordance to start a draft.
3. **Disconnected Navigation**: Users who navigate from the Profile tab to "My product drafts" find a dead-end if they have no drafts, forcing them to navigate back and find the scan tab.

## Requirements

### Functional Requirements
1. **Header Action & Floating Action Button (FAB)**:
   - Add a top-right "+ Add" pill button in the `ProductDraftsScreen` header.
   - Add a prominent primary Floating Action Button or Bottom Bar CTA "+ Add Product Draft" on the screen.
2. **Action Sheet / Choice Flow on "+ Add Draft"**:
   - Tapping "+ Add Draft" presents two straightforward options:
     1. 📷 **Scan barcode or QR code** -> navigates directly to `ScanScreen` (`navigation.push('Scan')`).
     2. ⌨️ **Enter barcode manually** -> opens `ManualCodeEntryModal`.
3. **Empty State Action Buttons**:
   - Enhance the `EmptyState` component inside `ProductDraftsScreen` with interactive CTAs:
     - Primary Button: "Scan product code" (`Button` with camera icon in Fresh Sage).
     - Secondary Button: "Enter code manually" (`Button` outline variant).
4. **Manual Code Entry Modal (`apps/mobile/src/components/ManualCodeEntryModal.tsx`)**:
   - Bottom sheet / modal with numeric input for standard barcodes (EAN-13, UPC-A, etc.) or alphanumeric QR payloads.
   - **Client-Side Format Validation**: Validates barcodes against `/^[0-9]{8,14}$/` matching `packages/shared/src/schemas/product.ts`, providing real-time inline helper text (e.g. "Barcodes must be 8-14 digits") and disabling submit until valid to prevent API 400 errors.
   - "Continue" button:
     - Invokes `createOrResumeDraft` via `useCreateOrResumeDraft()`.
     - Automatically routes to `ProductNew` with `{ barcode, resume: 'edit' }`.
5. **Profile Tab Drafts Badge**:
   - Query draft count on the Profile tab row ("My product drafts (3)") so users have visual visibility into pending drafts.

### Non-functional Requirements
- Maintain optimistic concurrency and existing draft coordinator integrity.
- Styled strictly adhering to Expyrico palette (Fresh Sage `#4BAE8A`, Mint Mist `#D6F0E6`, Warm White `#FAFAF8`, Almost Black `#2C2C28`).

## UX Flow Diagram

```
+-------------------------------------------------------------+
|                      ProductDraftsScreen                    |
|                                                             |
|  [ My Product Drafts ]                  [ + Add Draft (CTA) ]
|  Products you've scanned and started adding...              |
|                                                             |
|  +-------------------------------------------------------+  |
|  | Draft 1: Organic Oat Milk             [ Awaiting Rev ]|  |
|  +-------------------------------------------------------+  |
|                                                             |
|                     [ + Add New Draft FAB ]                 |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                 Choose Draft Creation Method                |
|                                                             |
|   [ 📷 Scan Barcode / QR ]        [ ⌨️ Enter Code Manually ] |
+-------------------------------------------------------------+
              |                                    |
              v                                    v
       (Opens Camera)                 (Opens Manual Code Modal)
                                                   |
                                                   v
                                      +-------------------------+
                                      | Enter Barcode / Code    |
                                      | [ 8935001234567       ] |
                                      | [ Create Draft -> ]     |
                                      +-------------------------+
                                                   |
                                                   v
                                          (Navigates to ProductNew)
```

## Related Code Files
- Create: `apps/mobile/src/components/ManualCodeEntryModal.tsx`
- Modify: `apps/mobile/app/(app)/product/drafts.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/profile.tsx`
- Modify: `apps/mobile/src/api/products.ts`

## Implementation Steps
1. Build `ManualCodeEntryModal.tsx` in `apps/mobile/src/components/` with numeric barcode regex validation (`/^[0-9]{8,14}$/`), clear button, and submission handler.
2. Update `ProductDraftsScreen` in `apps/mobile/app/(app)/product/drafts.tsx`:
   - Add "+ Add Draft" header button and bottom Floating Action Button.
   - Wire action sheet with "Scan Barcode" and "Enter Manually".
   - Enhance empty state with actionable scan and manual entry buttons.
3. Wire `ManualCodeEntryModal` submission to `createOrResumeDraft` mutation and navigate seamlessly to `ProductNewScreen`.
4. Update `Profile` screen in `apps/mobile/app/(app)/(tabs)/profile.tsx` to display active drafts count badge on the drafts menu item.
5. Write component tests for `ProductDraftsScreen` verifying that add buttons trigger navigation and manual modal correctly.

## Success Criteria
- [ ] `ProductDraftsScreen` features visible "+ Add Draft" buttons in both header and empty state.
- [ ] Tapping "Scan product code" navigates directly to `ScanScreen`.
- [ ] Tapping "Enter code manually" opens `ManualCodeEntryModal`.
- [ ] `ManualCodeEntryModal` enforces 8-14 numeric digits before enabling submit.
- [ ] Submitting a valid barcode in the manual modal initiates a draft and opens `ProductNewScreen`.
- [ ] Profile tab displays accurate draft count indicator.

## Risk Assessment
- **Risk**: User enters a barcode for an existing active catalog product.
  - **Mitigation**: `createOrResumeDraft` backend already handles existing active products by returning an `already_exists` outcome or resuming existing draft; the mobile client gracefully detects this and routes to view the product or continue editing.
