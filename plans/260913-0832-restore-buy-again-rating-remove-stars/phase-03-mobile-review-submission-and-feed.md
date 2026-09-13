---
phase: 3
title: "Mobile Review Submission & Product Detail Feed"
status: pending
priority: P1
effort: "5h"
dependencies: ["1", "2"]
---

# Phase 3: Mobile Review Submission & Product Detail Feed

## Overview
Reconstruct the mobile review creation and editing flow (`review.tsx`) to feature the 3-option recommendation selector card with Expyrico styling and remove all star selector code. Update the product reviews screen (`reviews.tsx`) and product details header (`[id].tsx`) to filter and display recommendation sentiments.
<!-- Updated: Validation Session 1 - Product detail header shows community sentiment % + user badge if reviewed -->
<!-- Updated: Validation Session 2 - Connection guard offline gating and score sort default -->

## Requirements
- Functional:
  - `review.tsx` displays the interactive **Tri-State Recommendation Card**:
    1. **Buy again**: icon `checkmark-circle`, label `Buy again`, sublabel `Top pick`, active border `#4BAE8A`, active bg `#D6F0E6`, active text `#3A8F6F`.
    2. **Buy on sale**: icon `pricetag`, label `Buy on sale`, sublabel `Worth deal`, active border `#F5A623`, active bg `#FEEFC3`, active text `#2C2C28`.
    3. **Won't buy**: icon `thumbs-down`, label `Won't buy`, sublabel `Pass on it`, active border `#8C8C85`, active bg `#F0F0ED`, active text `#2C2C28`.
  - Form validation requires user to select one of the three recommendation options before submission (`Please select whether you recommend this product.`).
  - Pre-populates recommendation option when editing an existing review.
  - Submission dispatches `{ rating, body: finalBody }` to `useCreateReview` / `useUpdateReview`.
  - In `reviews.tsx`: filter pills bar renders `[All]`, `[Buy again (N)]`, `[Buy on sale (M)]`, and `[Won't buy (K)]`. Selecting a pill filters reviews by `r.rating`.
  - In `[id].tsx`: under product title, replace star row with community recommendation sentiment (`👍 85% recommend · 24 ratings`) linking to `ProductReviews`, plus the user's personal recommendation badge pill (`[✓ Buy again] Your review`) if the user has already reviewed the product.
  - Submission is gated by `useConnectionGuardStore`: if disconnected, immediately opens offline modal notice to prevent sync loss.
  - In `reviews.tsx`: default sorting initializes to `sort: 'score'` (Wilson lower bound) to surface high-quality community feedback first.
- Non-functional:
  - Touch targets $\ge 44\text{dp}$ on all recommendation cards and filter pills.
  - Strict compliance with Expyrico color palette and dark mode compatibility.

## Architecture
```
Recommendation Selector UI (review.tsx):
+-------------------------------------------------------------+
| Rate this product                                *Required  |
|                                                             |
| +-------------+  +---------------+  +---------------------+  |
| |    ( ✓ )    |  |     ( $ )     |  |        ( 👎 )       |  |
| |  Buy again  |  |  Buy on sale  |  |      Won't buy      |  |
| |  Top pick   |  |  Worth deal   |  |     Pass on it      |  |
| +-------------+  +---------------+  +---------------------+  |
+-------------------------------------------------------------+
| Your thoughts (optional)                                    |
| [ Share what you liked, taste, value...                   ] |
|                                                   0/2000    |
+-------------------------------------------------------------+
| [ Submit review ]                                           |
+-------------------------------------------------------------+
```

## Related Code Files
- Modify: `apps/mobile/app/(app)/product/[id]/review.tsx`
- Modify: `apps/mobile/app/(app)/product/[id]/reviews.tsx`
- Modify: `apps/mobile/app/(app)/product/[id].tsx`
- Modify: `apps/mobile/tests/unit/product-review-screen.test.tsx`
- Modify: `apps/mobile/tests/unit/product-reviews-page.test.tsx`
- Modify: `apps/mobile/__tests__/routes/product-detail.test.tsx`

## Implementation Steps
1. In `apps/mobile/app/(app)/product/[id]/review.tsx`:
   - Re-introduce `RECOMMENDATION_OPTIONS` constant with Expyrico theme tokens:
     - `buy_again`: Fresh Sage `#4BAE8A` / Mint Mist `#D6F0E6` / Deep Sage `#3A8F6F`.
     - `buy_again_on_sale`: Honey `#F5A623` / Soft Butter `#FEEFC3` / Almost Black `#2C2C28`.
     - `wont_buy`: Pebble `#8C8C85` / Stone `#F0F0ED` / Almost Black `#2C2C28`.
   - Remove `stars` state, `handleSelectStars`, `ratingToStars`, `starsToRating`, and the 1-to-5 star selector card.
   - Set state: `const [rating, setRating] = useState<ReviewRating | null>(existingReview?.rating ?? null);`.
   - Validation in `onSubmit`: `if (!rating) { setError('Please select whether you recommend this product.'); return; }`.
   - Gated by `useConnectionGuardStore`: check connection before mutation and open offline dialog if disconnected.
   - Submit payload: `{ rating, body: finalBody }`.
2. In `apps/mobile/app/(app)/product/[id]/reviews.tsx`:
   - Initialize `sort: 'score'` by default.
   - Replace `selectedStar` state with `selectedRating: ReviewRating | 'all'`.
   - Filter logic: `if (selectedRating !== 'all' && r.rating !== selectedRating) return false;`.
   - Replace star filter pills with recommendation filter pills:
     - `All (${allReviews.length})`
     - `Buy again (${buyAgainCount})`
     - `Buy on sale (${buyAgainOnSaleCount})`
     - `Won't buy (${wontBuyCount})`
   - Active filter indicator updates to `Clear filter (${activeLabel}) ✕`.
3. In `apps/mobile/app/(app)/product/[id].tsx`:
   - Replace `product-header-stars` with `product-header-sentiment`.
   - Render community sentiment score: `(👍 ${scorePct}% recommend · ${ratingCount})` linking to `ProductReviews`.
   - If the active user has reviewed, render a companion pill badge with their personal recommendation (`[✓ Buy again] Your review`).
4. Update mobile unit tests:
   - `product-review-screen.test.tsx`: test tapping `Buy again`, `Buy on sale`, and `Won't buy` radio cards; verify mutation payload receives `{ rating: 'buy_again' }`.
   - `product-reviews-page.test.tsx`: test filtering reviews by recommendation pills.
   - `product-detail.test.tsx`: verify recommendation badge displays on product header.

## Success Criteria
- [x] Review creation form displays 3 recommendation pills and zero star icons.
- [x] Submitting without choosing an option triggers an inline error message.
- [x] Editing an existing review pre-selects the saved recommendation option.
- [x] Product reviews list filters correctly when tapping `Buy again`, `Buy on sale`, or `Won't buy`.
- [x] Product detail header displays the user's recommendation pill.
- [x] Mobile unit tests pass cleanly (`pnpm --filter mobile test`).

## Risk Assessment
- **Risk:** Keyboard offset or screen overflow issues on small Android devices when viewing recommendation cards and text input.
  - *Observable signal:* Submit button hidden or clipped by virtual keyboard.
  - *Mitigation:* Preserve `KeyboardAwareScrollView` with `extraKeyboardOffset={140}` on Android.
