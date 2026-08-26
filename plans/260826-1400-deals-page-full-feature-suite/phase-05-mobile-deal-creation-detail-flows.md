---
phase: 5
title: "Mobile Deal Creation & Detail Flows"
status: completed
priority: P1
dependencies: ["phase-03-mobile-api-client-hooks", "phase-04-mobile-dealfeed-search-filters"]
---

# Phase 5: Mobile Deal Creation & Detail Flows

<!-- Updated: Validation Session 1 - Mandatory photo proof, optional expiry date, hybrid store suggestions -->

## Overview
Implement the full deal creation and management workflow in the mobile app. Enhance `NewDealScreen` (`apps/mobile/app/(app)/deal/new.tsx`) with product search, barcode scanning, recent pantry item picker, and resolve the `editId` bug so existing deals can be properly edited. Upgrade `DealForm` with mandatory photo proof attachment (receipt / price tag camera & gallery picker), optional date picker modal, and hybrid store autocomplete. Polish `DealDetailScreen` (`apps/mobile/app/(app)/deal/[id].tsx`) with rich product metadata, shelf photo previews, vote analytics, native sharing, and author edit/delete actions.

## Requirements

### Functional Requirements
- **Post a Deal Screen (`NewDealScreen`)**:
  - **Edit Mode Resolution**: Check `route.params?.editId`. If present, fetch existing deal via `useDeal(editId)` and pre-populate `DealForm(existing=deal, product=deal.product)`.
  - **Product Selection Options**:
    - **Catalog Search**: Live search against `useProductSearch(q)` with instant results.
    - **Barcode Scanner Shortcut**: "Scan Barcode" button that opens camera scanner or modal to immediately look up barcode in product catalog.
    - **Pick From My Pantry**: Quick list of user's recently logged pantry records for effortless deal posting.
  - Selected product card with thumbnail, brand, and name with a "Change product" button.
- **Deal Form (`DealForm`)**:
  - **Mandatory Photo Proof**: Image picker (Camera or Gallery) with live preview and upload progress to attach a receipt or shelf price tag photo (enforced before submission per Validation Session 1).
  - **Price & Currency**: Formatted numeric input with currency selector / default.
  - **Store Name**: Text input with hybrid store suggestion chips (Trader Joe's, ALDI, Walmart, Costco, Target, Whole Foods, etc.).
  - **Expiry Date (Optional)**: Tap to open `WheelDatePickerModal` or clear date.
  - **Note**: Multiline input for special deal conditions (e.g. "Buy 1 get 1 free", "Manager clearance markdown").
  - Submit button in Fresh Sage (`#4BAE8A`) with loading spinner.
- **Deal Detail Screen (`DealDetailScreen`)**:
  - **Hero Product Card**: High-resolution product image, brand badge, product title.
  - **Price Banner**: Prominent price in Deep Sage (`#3A8F6F`), store name, and posting timestamp.
  - **Deal / Shelf Photo**: Expandable image card displaying verified photo proof.
  - **Expiry Status Card**: Color-coded expiry pill with days remaining countdown (if expiry date was provided).
  - **Community Score & Voting**: Upvote / Downvote buttons with vote count pills and percentage helpful breakdown.
  - **Poster Attribution**: Author avatar, first name, and member badge.
  - **Author Actions**: "Edit deal" (navigates to `DealNew` with `editId`) and "Delete deal" with destructive confirmation alert.
  - **General Actions**: "Share deal" (invoking React Native `Share.share` with deal details and deep link) and "Report deal".

### Non-Functional Requirements
- Form input validation with clear inline error messages.
- Clean navigation back handling and cache invalidation.
- Follow Expyrico color palette and accessibility guidelines.

## Architecture
```
NewDealScreen (apps/mobile/app/(app)/deal/new.tsx)
  ├── Mode Selector (Search Catalog / Scan Barcode / My Pantry Items)
  └── DealForm (apps/mobile/src/features/deals/DealForm.tsx)
        ├── Product Summary Header
        ├── Mandatory Photo Proof Attachment (Camera / Gallery)
        ├── Price & Currency Fields
        ├── Store Autocomplete Chips (Hybrid)
        ├── Optional DatePicker Modal Integration
        └── Submit Button

DealDetailScreen (apps/mobile/app/(app)/deal/[id].tsx)
  ├── Product Hero Card & Brand
  ├── Price & Store Location Pill
  ├── Verified Photo Proof Viewer
  ├── Expiry Countdown Pill (Color-coded)
  ├── Deal Note Block
  ├── Optimistic Upvote / Downvote Bar
  ├── Author Attribution Pill
  └── Action Buttons (Share, Report, Edit [Author], Delete [Author])
```

## Related Code Files
- Modify: `apps/mobile/app/(app)/deal/new.tsx`
- Modify: `apps/mobile/src/features/deals/DealForm.tsx`
- Modify: `apps/mobile/app/(app)/deal/[id].tsx`
- Modify: `apps/mobile/src/navigation/AppNavigator.tsx`
- Test: `apps/mobile/__tests__/DealForm.test.tsx`
- Test: `apps/mobile/__tests__/DealDetailScreen.test.tsx` (new)
- Test: `apps/mobile/__tests__/NewDealScreen.test.tsx` (new)

## Implementation Steps
1. **Fix & Upgrade `NewDealScreen` (`apps/mobile/app/(app)/deal/new.tsx`):**
   - Read `route.params?.editId`. If present, fetch deal with `useDeal(editId)` and show loading state until loaded.
   - Implement tabbed/segmented product picker (Search / Scan / Pantry).
2. **Upgrade `DealForm` (`apps/mobile/src/features/deals/DealForm.tsx`):**
   - Add image picker adapter for mandatory photo proof.
   - Integrate `WheelDatePickerModal` for optional expiration date.
   - Add store quick-select chips from `useDealStores()`.
   - Add validation error rendering and disabled submission state while saving.
3. **Enhance `DealDetailScreen` (`apps/mobile/app/(app)/deal/[id].tsx`):**
   - Build product hero section with image and brand.
   - Render color-coded expiry badge matching Expyrico palette.
   - Implement `Share.share` native sharing action.
   - Add confirmation alert for deal deletion.
4. **Update App Navigation Types (`apps/mobile/src/navigation/AppNavigator.tsx`):**
   - Verify `DealNew: { editId?: string; productId?: string } | undefined` is typed and handled.
5. **Add Automated Component Tests:**
   - Test deal creation form submission with mandatory photo.
   - Test deal editing prefill when `editId` is provided.
   - Test delete confirmation and share action trigger in `DealDetailScreen`.

## Success Criteria
- [ ] Users can post a new deal by searching a product, scanning a barcode, or picking a pantry item.
- [ ] Mandatory photo proof is attached and validated before posting.
- [ ] Users can edit their existing deals without form loss (fixing `editId` bug).
- [ ] DealDetailScreen displays full product details, shelf photo, expiry badge, voting buttons, and share action.
- [ ] All tests in `DealForm.test.tsx`, `DealDetailScreen.test.tsx`, and `NewDealScreen.test.tsx` pass.

## Risk Assessment
- **Risk:** Missing product details when entering edit mode if the deal was created for a newly registered product.
- **Mitigation:** Ensure API `GET /deals/:id` always includes the nested `product` object with name, brand, and image.
