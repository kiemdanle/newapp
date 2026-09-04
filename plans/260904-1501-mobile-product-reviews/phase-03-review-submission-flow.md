---
phase: 3
title: "Review Submission Flow and Sentiment Selector"
status: pending
priority: P1
effort: "4-5h"
dependencies: [1, 2]
---

# Phase 3: Review Submission Flow and Sentiment Selector

## Overview
Transform `apps/mobile/app/(app)/product/[id]/review.tsx` from an unwired mock into a complete, user-tested review submission experience. Uses `useMyProductReview(id)` to authoritatively determine edit vs. create mode, replaces the legacy 1–5 star rating with Expyrico's three-pill recommendation selector (`Buy again`, `Buy on sale`, `Won't buy`), binds the form to `useCreateReview()` and `useUpdateReview()`, normalizes empty comments to `null`, provides real-time character counting, handles moderation feedback for profanity-flagged reviews, and ensures clean Android back-navigation.

<!-- Updated: Red Team Review - Uses useMyProductReview for authoritative edit/create detection (never scans paginated feeds), normalizes empty comment text to null, and strictly styles wont_buy with neutral Stone/Pebble/Almost Black -->

## Requirements

### Functional
- **Authoritative Edit/Create Detection**:
  - Uses `useMyProductReview(productId)` to load any pre-existing review for the current user.
  - If a review exists: initializes `rating` and `body`, displays header `"Edit your review"`, and routes submission to `useUpdateReview()`.
  - If no review exists: starts with empty fields, displays header `"Write a review"`, and routes submission to `useCreateReview()`.
- **Tri-State Recommendation Selector**:
  - Three accessible radio pill options:
    1. **Buy again** (`buy_again`): Recommended for full price. Styled with Fresh Sage (`#4BAE8A`) border/accent, Mint Mist (`#D6F0E6`) active background, and checkmark icon.
    2. **Buy on sale** (`buy_again_on_sale`): Worth it at a discount. Styled with Honey (`#F5A623`) border/accent, Soft Butter (`#FEEFC3`) active background, and tag icon.
    3. **Won't buy** (`wont_buy`): Not recommended. **Strictly compliant with Expyrico palette** (Alert Red is forbidden for recommendations): styled with Stone (`#F0F0ED`) background, Pebble (`#8C8C85`) border, and Almost Black (`#2C2C28`) text with a thumbs-down icon.
  - Interactive selection provides light haptic feedback and clear active state indicators.
- **Review Comment Input & Normalization**:
  - Multi-line text input with `maxLength={2000}`.
  - Displays remaining character counter (e.g. `124/2000`).
  - Label: `"Your thoughts (optional)"`.
  - Input normalization: trimmed empty or whitespace-only input is normalized to `undefined` (persisted as `null` by backend), ensuring accurate `reviewCount`.
- **Submission & Moderation Feedback**:
  - Disables submit button while pending (`busy = true`).
  - Upon submission:
    - If `status === 'hidden'` (flagged by automated profanity filter): shows distinct panel `"Your review was submitted and is pending community moderation. It will become visible once approved."`
    - If `status === 'visible'`: shows success toast/screen `"Review published! Thanks for helping the community."` and auto-navigates back to the product details screen.
- **Back Button & Unsaved Changes**:
  - Header back button and Android hardware back button cleanly dismiss without errors.
  - Prompts confirmation if user entered non-empty review text before discarding.

### Non-Functional
- Adheres to `ak:ui-ux-pro-max` guidelines: minimum touch targets $\ge 44\times 44\text{ pt}$ (`minHeight: 44`), proper `accessibilityRole="radiogroup"` and `accessibilityRole="radio"` attributes.
- Colors resolve exclusively to the Expyrico palette (`docs/design/expyrico-colour-palette.md`). Alert Red `#E0442A` is never used for recommendations.

## Architecture & Layout

```
+-------------------------------------------------------------+
|  <- Back                                      Write a Review |
+-------------------------------------------------------------+
|                                                             |
|  Product Name                                               |
|  Brand · Size                                               |
|                                                             |
|  Would you recommend this item?                             |
|  +----------------+ +------------------+ +---------------+  |
|  | (V) Buy again  | | ($) Buy on sale  | | (X) Won't buy |  |
|  +----------------+ +------------------+ +---------------+  |
|                                                             |
|  Your thoughts (optional)                                   |
|  +-------------------------------------------------------+  |
|  | Tastes great with oatmeal. Stays fresh for 2 weeks... |  |
|  |                                                       |  |
|  |                                             124/2000  |  |
|  +-------------------------------------------------------+  |
|                                                             |
|  [ Submit Review ]                                          |
+-------------------------------------------------------------+
```

## Related Code Files
- Modify: `apps/mobile/app/(app)/product/[id]/review.tsx`
- Read: `apps/mobile/src/components/TextField.tsx`
- Read: `apps/mobile/src/components/Button.tsx`
- Read: `apps/mobile/src/api/reviews.ts`
- Read: `apps/mobile/src/api/products.ts`
- Test: `apps/mobile/tests/unit/product-review-screen.test.tsx`

## Implementation Steps

1. **Refactor Recommendation Selector Component**:
   - Render 3 pills with icons (`buy_again`: checkmark, `buy_again_on_sale`: tag, `wont_buy`: thumbs-down).
   - Apply active backgrounds: Mint Mist `#D6F0E6` (Fresh Sage), Soft Butter `#FEEFC3` (Honey), Neutral Stone `#F0F0ED` (Pebble/Almost Black). Zero Alert Red.

2. **Integrate Authoritative Existing Review Data**:
   - Query product details via `useProduct(id)` to show product title and brand.
   - Query user's existing review via `useMyProductReview(id)`.
   - Initialize `rating` and `body` from existing review if present.

3. **Wire Submission Mutation**:
   - Validate that a recommendation is selected.
   - Normalize empty/whitespace body to `undefined`.
   - Call `createReview.mutateAsync` or `updateReview.mutateAsync`.
   - On success, display feedback and navigate back via `navigation.goBack()`.

4. **Add Unit & Integration Tests (`tests/unit/product-review-screen.test.tsx`)**:
   - Test validation error when submitting with no rating selected.
   - Test submitting `buy_again` with custom body text.
   - Test authoritative pre-population of existing review fields.
   - Test empty string normalization.
   - Test profanity-flagged review feedback banner.

## Success Criteria
- [ ] Review screen authoritatively determines edit vs. create mode via `useMyProductReview`.
- [ ] Recommendation pills strictly adhere to Expyrico palette (`wont_buy` uses neutral Stone/Pebble/Almost Black, no Alert Red).
- [ ] Tapping submit sends typed payload to `POST /v1/products/:id/reviews` (or PATCH).
- [ ] Empty comment text normalizes to `null`.
- [ ] Character counter accurately updates up to 2000 characters.
- [ ] All interactive buttons and pills meet $\ge 44\text{ pt}$ minimum touch target (`minHeight: 44`).
- [ ] Unit tests pass 100%.
