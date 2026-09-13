---
phase: 5
title: "Admin Review Moderation & Analytics"
status: pending
priority: P2
effort: "3h"
dependencies: ["1", "2"]
---

# Phase 5: Admin Review Moderation & Analytics

## Overview
Update the Admin review moderation console and backend admin analytics to filter, aggregate, and display reviews by their tri-state recommendation sentiment (`buy_again`, `buy_again_on_sale`, `wont_buy`) instead of numeric star ratings.

## Requirements
- Functional:
  - In `apps/admin/src/app/(admin)/reviews/page.tsx`:
    - Table column: Header changes from `Star Rating` to `Sentiment / Rating`.
    - Filter dropdown: Change options to `Purchase Sentiment`:
      - `buy_again`: "Buy again"
      - `buy_again_on_sale`: "Buy again on sale"
      - `wont_buy`: "Won't buy"
    - Table rows: Render recommendation badge pills:
      - `buy_again`: Emerald/Mint badge (`bg-emerald-50 text-emerald-700 border-emerald-200`)
      - `buy_again_on_sale`: Amber/Butter badge (`bg-amber-50 text-amber-800 border-amber-200`)
      - `wont_buy`: Stone/Slate badge (`bg-neutral-100 text-neutral-700 border-neutral-200`)
  - In `apps/admin/src/app/(admin)/reviews/[id]/page.tsx`:
    - Review detail card displays the recommendation rating badge alongside review status, author info, and report flags.
  - In `api/src/services/admin/analytics.ts`:
    - `reviewsDaily` aggregation groups reviews by `rating` (`buy_again`, `buy_again_on_sale`, `wont_buy`) and returns `byRating` counts.
- Non-functional:
  - Touch targets $\ge 44\text{dp}$ on admin filter controls and action buttons.
  - Color palette matches Expyrico standards.

## Architecture
```
Admin Review Moderation Table:
+-----------------------------------------------------------------------------------+
| Reviewer    | Product            | Sentiment / Rating      | Status    | Actions  |
+-----------------------------------------------------------------------------------+
| John D.     | Organic Oat Milk   | [ ✓ Buy again ]         | Visible   | [View]   |
| Sarah K.    | Almond Granola     | [ $ Buy on sale ]       | Visible   | [View]   |
| Alex M.     | Greek Yogurt       | [ 👎 Won't buy ]        | Flagged   | [Mod]    |
+-----------------------------------------------------------------------------------+
```

## Related Code Files
- Modify: `apps/admin/src/app/(admin)/reviews/page.tsx`
- Modify: `apps/admin/src/app/(admin)/reviews/[id]/page.tsx`
- Modify: `api/src/services/admin/analytics.ts`
- Modify: `apps/admin/src/lib/admin-api.ts`

## Implementation Steps
1. In `apps/admin/src/app/(admin)/reviews/page.tsx`:
   - Update `RATING_LABELS` mapping:
     `buy_again: 'Buy again', buy_again_on_sale: 'Buy again on sale', wont_buy: "Won't buy"`.
   - Update `FILTER_OPTIONS` to pass `buy_again`, `buy_again_on_sale`, `wont_buy` values.
   - In columns definition: column header is `Sentiment / Rating`, rendering badge based on `r.rating`.
2. In `apps/admin/src/app/(admin)/reviews/[id]/page.tsx`:
   - Replace star indicators with recommendation sentiment badge.
3. In `api/src/services/admin/analytics.ts`:
   - In daily reviews aggregation, group by `rating` and compute breakdown:
     `{ buy_again: count, buy_again_on_sale: count, wont_buy: count }`.
4. Run admin typecheck and unit tests:
   `pnpm --filter admin typecheck && pnpm --filter admin test`.

## Success Criteria
- [x] Admin reviews table displays `Buy again`, `Buy on sale`, and `Won't buy` badges with zero star icons.
- [x] Filtering by `buy_again` returns only reviews with `rating = 'buy_again'`.
- [x] Admin review detail page displays recommendation badge correctly.
- [x] Admin build succeeds with 0 TypeScript errors.

## Risk Assessment
- **Risk:** Existing admin URL queries containing `?rating=5` or `?rating=4` return no results.
  - *Observable signal:* Empty table when navigating with legacy bookmark query params.
  - *Mitigation:* Gracefully ignore invalid or numeric rating query params, falling back to all reviews.
