---
phase: 2
title: "Mobile Review Form Streamlining (review.tsx)"
status: pending
priority: P1
effort: "4h"
dependencies: ["phase-01-start.md"]
---

# Phase 2: Mobile Review Form Streamlining (review.tsx)

## Overview
Streamline the mobile review creation and editing screen (`apps/mobile/app/(app)/product/[id]/review.tsx`) by removing the redundant tri-state recommendation card ('Buy again', 'Buy on sale', "Won't buy") and keeping only the polished 1-to-5 star rating selector.

## Requirements
- Functional:
  - Remove `RECOMMENDATION_OPTIONS` array and the `/* Tri-State Recommendation Selector Card */` from JSX (lines 490–583).
  - Remove `starsToRating` and `ratingToStars` mapping functions.
  - Maintain only `stars` state (`number`, default from `existingReview?.stars ?? 0`).
  - Keep the `/* 1 to 5 Star Rating Selector Card */` ("Rate this product"):
    - 5 interactive star icons with press scale feedback (`hitSlop={6}`).
    - Golden Honey star color (`#F5A623`) for filled stars.
    - Sentiment badge with dynamic text captions:
      - `5 / 5 · Excellent!`
      - `4 / 5 · Great!`
      - `3 / 5 · Good`
      - `2 / 5 · Fair`
      - `1 / 5 · Poor`
      - `Tap a star to rate` (when 0)
    - Full accessibility role (`radiogroup` and `radio` per star).
  - Validation:
    - User must tap at least 1 star before submitting (`stars >= 1`).
    - If `stars === 0`, display inline error `"Please select a star rating"`.
  - Mutation payload:
    - Send `{ stars, body: body.trim() || null }` directly to `createReviewMutation` and `updateReviewMutation`.
- Non-functional:
  - Adhere to Expyrico theme tokens in dark and light modes.
  - Preserves character count limit (2000 chars) and moderation feedback.
  - Updates mobile unit tests in `product-review-screen.test.tsx`.

## Architecture
- `apps/mobile/app/(app)/product/[id]/review.tsx`:
  - Main review creation and editing screen component.
- `apps/mobile/src/api/reviews.ts`:
  - Typed React Query mutation hooks (`useCreateReview`, `useUpdateReview`).
- `apps/mobile/tests/unit/product-review-screen.test.tsx`:
  - Unit test suite covering star selection, validation errors, and submission.

## Related Code Files
- Modify:
  - `apps/mobile/app/(app)/product/[id]/review.tsx`
  - `apps/mobile/src/api/reviews.ts`
  - `apps/mobile/tests/unit/product-review-screen.test.tsx`

## Implementation Steps
1. In `review.tsx`:
   - Delete `RECOMMENDATION_OPTIONS` and `handleSelectRecommendation`.
   - Delete `starsToRating` and `ratingToStars`.
   - Update `stars` state initialization from `existingReview?.stars`.
   - Remove the recommendation card JSX block.
   - Update submit handler to validate `stars >= 1` and dispatch `{ stars, body }`.
2. In `apps/mobile/src/api/reviews.ts`:
   - Update `ReviewMutationPayload` type: `{ stars: number; body?: string | null }`.
3. In `tests/unit/product-review-screen.test.tsx`:
   - Remove tests expecting "Buy again", "Buy on sale", "Won't buy" options.
   - Add tests verifying star rating selection (`rating-star-1` through `rating-star-5`), captions, validation, and submission.
4. Run `pnpm --filter mobile test product-review-screen.test.tsx`.

## Success Criteria
- [x] Review creation screen shows only 1-to-5 star selector and optional text comment.
- [x] Zero instances of "Buy again", "Buy on sale", or "Won't buy" on the screen.
- [x] Submitting without stars shows validation error.
- [x] Submitting 4 stars correctly sends `{ stars: 4 }` to the backend.
- [x] All unit tests in `product-review-screen.test.tsx` pass cleanly.

## Risk Assessment
- **Risk**: Existing review edits pre-populating with undefined stars.
  - **Mitigation**: Fallback `existingReview?.stars ?? (existingReview?.rating === 'buy_again' ? 5 : ...)` to ensure seamless backward compatibility.
