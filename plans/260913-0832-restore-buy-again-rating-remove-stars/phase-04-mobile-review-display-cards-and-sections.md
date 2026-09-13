---
phase: 4
title: "Mobile Review Display Cards & Section Overhaul"
status: pending
priority: P1
effort: "4h"
dependencies: ["1", "2", "3"]
---

# Phase 4: Mobile Review Display Cards & Section Overhaul

## Overview
Overhaul all mobile review display components (`ReviewCard`, `MyReviewCard`, `ProductCommunityCard`, `ProductReviewsSection`) to display the tri-state recommendation badges and percentage tallies, eliminating all 1-to-5 star rows and decimal star averages.
<!-- Updated: Validation Session 1 - Combined Buy again + Buy on sale recommendation percentage -->
<!-- Updated: Validation Session 2 - Zero-review empty state with Write a review CTA -->

## Requirements
- Functional:
  - `ReviewCard`: replace star row and `5.0` rating with a recommendation badge pill in the card header:
    - `buy_again`: Mint Mist `#D6F0E6` bg, Fresh Sage `#4BAE8A` border, Deep Sage `#3A8F6F` text, icon `checkmark-circle`, label `Buy again`.
    - `buy_again_on_sale`: Soft Butter `#FEEFC3` bg, Honey `#F5A623` border, Almost Black `#2C2C28` text, icon `pricetag`, label `Buy on sale`.
    - `wont_buy`: Stone `#F0F0ED` bg, Pebble `#8C8C85` border, Almost Black `#2C2C28` text, icon `thumbs-down`, label `Won't buy`.
  - `MyReviewCard`: render recommendation badge pill next to relative date; delete star row.
  - `ProductReviewsSection` (on Product Detail):
    - Hero sentiment score: calculate positive recommendation percentage:
      `scorePct = Math.round(((buyAgainCount + buyAgainOnSaleCount) / Math.max(ratingCount, 1)) * 100)`.
    - Display: e.g. `85% recommend` with icon `thumbs-up` in Fresh Sage `#4BAE8A`.
    - Tally breakdown row: display count pills:
      `[ 18 Buy again ]` `[ 4 On sale ]` `[ 2 Won't buy ]`.
    - Zero stars references or decimal averages (`out of 5 stars` deleted).
  - `ProductCommunityCard`: render recommendation badge pill on recent community review preview.
  - When a product has 0 reviews (`ratingCount === 0`), render an empty state card encouraging user contribution: "No community ratings yet. Be the first to rate this product!" with a prominent "Write a review" button.
- Non-functional:
  - Pixel-perfect Expyrico color palette compliance (`docs/design/expyrico-colour-palette.md`).
  - Strict touch target compliance on all interactive elements ($\ge 44\text{dp}$).

## Architecture
```
ReviewCard Header Layout:
+-------------------------------------------------------------+
| [Avatar] Dan Le                    [ (✓) Buy again ]        |
|          2d ago                                             |
|                                                             |
| "Super smooth texture and great taste. Will buy regularly!" |
|                                                             |
| [👍 Helpful (3)]                                            |
+-------------------------------------------------------------+

ProductReviewsSection Breakdown:
+-------------------------------------------------------------+
| Community Reviews                              (24 reviews) |
|                                                             |
|   (👍) 85% recommend                                        |
|   Based on 24 community ratings                             |
|                                                             |
|   [ 18 Buy again ]   [ 4 Buy on sale ]   [ 2 Won't buy ]    |
|                                                             |
| [ Recent Review Card ]                                      |
| [ See all 24 reviews -> ]                                   |
+-------------------------------------------------------------+
```

## Related Code Files
- Modify: `apps/mobile/src/features/reviews/ReviewCard.tsx`
- Modify: `apps/mobile/src/features/reviews/MyReviewCard.tsx`
- Modify: `apps/mobile/src/features/reviews/ProductReviewsSection.tsx`
- Modify: `apps/mobile/src/features/reviews/ProductCommunityCard.tsx`
- Modify: `apps/mobile/tests/unit/product-reviews-section.test.tsx`
- Modify: `apps/mobile/tests/unit/reviews-hub.test.tsx`

## Implementation Steps
1. In `apps/mobile/src/features/reviews/ReviewCard.tsx`:
   - Define `BADGE_CONFIG` mapping `ReviewRating` to icon, background, border, and text colors using theme tokens.
   - Replace lines 85–101 (star row and `stars.0` text) with `<View style={styles.badge}><Ionicons name={badge.icon} ... /><Text style={styles.badgeText}>{badge.label}</Text></View>`.
   - Remove `stars` calculation and imports.
2. In `apps/mobile/src/features/reviews/MyReviewCard.tsx`:
   - Remove `starsGroup`, star mapping loop, and `stars.0` text.
   - Insert Recommendation Badge pill with icon and label.
3. In `apps/mobile/src/features/reviews/ProductReviewsSection.tsx`:
   - Compute recommendation sentiment:
     `const recommendPct = ratingCount > 0 ? Math.round(((buyAgainCount + buyAgainOnSaleCount) / ratingCount) * 100) : null;`
   - Replace star icon and `avgScore.toFixed(1) out of 5 stars` with:
     - Thumbs-up icon in Fresh Sage `#4BAE8A`.
     - Text: `${recommendPct !== null ? `${recommendPct}%` : '0%'} recommend`.
     - Subtitle: `Based on ${ratingCount} rating${ratingCount === 1 ? '' : 's'}`.
   - Render 3 breakdown chips in horizontal row:
     - Buy again: `${buyAgainCount} Buy again`
     - Buy on sale: `${buyAgainOnSaleCount} On sale`
     - Won't buy: `${wontBuyCount} Won't buy`
   - When `ratingCount === 0`, display empty state card with "No community ratings yet. Be the first to rate this product!" and a prominent "Write a review" CTA button navigating to `ProductReview`.
4. In `apps/mobile/src/features/reviews/ProductCommunityCard.tsx`:
   - In review preview snippet: replace star indicators with Recommendation Badge.
5. Update mobile unit tests:
   - `product-reviews-section.test.tsx`: assert presence of `% recommend` and breakdown count pills (`Buy again`, `On sale`, `Won't buy`).
   - `reviews-hub.test.tsx`: assert recommendation badges rendered on cards.

## Success Criteria
- [x] `ReviewCard` renders `Buy again`, `Buy on sale`, or `Won't buy` badge pill and zero star icons.
- [x] `MyReviewCard` displays recommendation badge alongside review actions.
- [x] `ProductReviewsSection` displays `% recommend` score and 3-option breakdown pills.
- [x] `ProductCommunityCard` displays recommendation badges in community feed.
- [x] Tests pass cleanly with zero star assertions remaining.

## Risk Assessment
- **Risk:** Zero-review products displaying `NaN% recommend` or dividing by zero.
  - *Observable signal:* NaN or crash on unreviewed products.
  - *Mitigation:* Safely fallback to `0% recommend` or empty state when `ratingCount === 0`.
