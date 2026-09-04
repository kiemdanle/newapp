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
Transform `apps/mobile/app/(app)/product/[id]/review.tsx` from an unwired mock into a complete, user-tested review submission experience. Replaces the legacy 1–5 star rating with Expyrico's three-pill recommendation selector (`Buy again`, `Buy on sale`, `Won't buy`), binds the form to `useCreateReview()` and `useUpdateReview()`, validates input constraints, provides real-time character counting, handles moderation feedback for profanity-flagged reviews, and ensures clean Android back-navigation.

## Requirements

### Functional
- **Tri-State Recommendation Selector**:
  - Three accessible radio pill options:
    1. **Buy again** (`buy_again`): Recommended for full price. Styled with Fresh Sage (`#4BAE8A`) border/accent, Mint Mist (`#D6F0E6`) active background, and checkmark icon.
    2. **Buy on sale** (`buy_again_on_sale`): Worth it at a discount. Styled with Honey (`#F5A623`) border/accent, Soft Butter (`#FEEFC3`) active background, and tag icon.
    3. **Won't buy** (`wont_buy`): Not recommended. **Strictly compliant with Expyrico palette** (Alert Red is forbidden for recommendations): styled with Stone (`#F0F0ED`) background, Pebble (`#8C8C85`) border, and Almost Black (`#2C2C28`) text with a thumbs-down icon.
  - Interactive selection provides light haptic feedback and clear active state indicators.
- **Review Comment Input**:
  - Multi-line text input with `maxLength={2000}`.
  - Displays remaining character counter (e.g. `124/2000`).
  - Label: `"Your thoughts (optional)"` with placeholder `"Share how it tastes, texture, value, or whether it lasts well..."`.
- **Edit vs Create Mode**:
  - If user has already reviewed the product, screen loads their existing review (`rating` and `body`) with header `"Edit your review"`, and routes submission through `useUpdateReview()`.
  - Otherwise, screen starts empty with header `"Write a review"`, routing through `useCreateReview()`.
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
- Colors resolve exclusively to the Expyrico palette (`docs/design/expyrico-colour-palette.md`). Alert Red `#E0442A` is never used for branding or recommendation states.

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
   - Create internal or reusable `RecommendationPills` selector accepting `value: ReviewRating | null`, `onChange: (rating: ReviewRating) => void`.
   - Render 3 pills with icons:
     - `buy_again`: `checkmark-circle-outline` or `thumbs-up-outline`
     - `buy_again_on_sale`: `pricetag-outline`
     - `wont_buy`: `thumbs-down-outline`
   - Apply active backgrounds:
     - `buy_again`: Mint Mist `#D6F0E6`, border Fresh Sage `#4BAE8A`.
     - `buy_again_on_sale`: Soft Butter `#FEEFC3`, border Honey `#F5A623`.
     - `wont_buy`: Neutral Stone `#F0F0ED`, border Pebble `#8C8C85`, text Almost Black `#2C2C28`. (Zero Alert Red).

2. **Integrate Existing Review Data Fetching**:
   - Query product details via `useProduct(id)` to show product title and brand.
   - Query user's existing review via `useProductReviews(id)` finding author match, or pass `existingReview` param via route.
   - Initialize `rating` and `body` from existing review if present.

3. **Wire Submission Mutation**:
   - Validate that a recommendation is selected (prompting `"Please select whether you would buy this again"` if null).
   - Call `createReview.mutateAsync` or `updateReview.mutateAsync`.
   - Handle API errors gracefully:
     - `409 REVIEW_ALREADY_EXISTS`: seamlessly prompt to update existing review.
     - Validation errors: display inline via `ErrorText`.
   - On success, display feedback and navigate back via `navigation.goBack()`.

4. **Add Unit & Integration Tests (`tests/unit/product-review-screen.test.tsx`)**:
   - Test validation error when submitting with no rating selected.
   - Test submitting `buy_again` with custom body text.
   - Test pre-populating existing review fields in edit mode.
   - Test profanity-flagged review feedback banner.

## Success Criteria
- [ ] Review screen displays product metadata and Expyrico 3-pill recommendation selector.
- [ ] Recommendation pills strictly adhere to Expyrico palette (`wont_buy` uses neutral Stone/Pebble/Almost Black, no Alert Red).
- [ ] Tapping submit sends typed payload to `POST /v1/products/:id/reviews` (or PATCH).
- [ ] Character counter accurately updates up to 2000 characters.
- [ ] All interactive buttons and pills meet $\ge 44\text{ pt}$ minimum touch target (`minHeight: 44`).
- [ ] Unit tests pass 100%.

## Risk Assessment
- **Risk**: User enters a lengthy review, experiences network timeout or error, and loses input.
- **Mitigation**: Keep form input state intact on error and display retryable banner rather than clearing inputs or resetting the screen.
