# Journal: Planning Reversal of Review Rating to Tri-State Recommendation & Removal of Stars

**Date:** 2026-09-13  
**Author:** AI Lead Engineer  
**Plan:** `plans/260913-0832-restore-buy-again-rating-remove-stars`

## Context & User Intent
Previously, the review system had been refactored to streamline to a numeric 1-to-5 star rating while removing the tri-state recommendation options (`'Buy again'`, `'Buy on sale'`, `'Won't buy'`).

The user has explicitly directed to reverse this decision:
- Bring back the 3-option recommendation model: `'Buy again'`, `'Buy on sale'`, and `'Won't buy'`.
- Remove the stars rating entirely across the entire stack.
- Keep only the `'Buy again'`, `'Buy on sale'`, and `'Won't buy'` rating model as the singular rating mechanism.

## Technical Architecture & Phasing
The plan is structured across 6 sequential phases:
1. **Phase 1: Shared Schemas & Database Contracts** — PostgreSQL migration making `reviews.rating` `NOT NULL`, deprecating `stars`, updating shared Zod schemas (`reviewRatingSchema`, `reviewCreateSchema`, `reviewPatchSchema`), building and syncing to mobile local-packages.
2. **Phase 2: Backend API Tallies, Serialization & Routes** — Updating `recomputeAndSyncProductTallies` to group by `rating`, ensuring `toApiReview` returns non-null `rating`, updating create/update/list review routes and product serializer.
3. **Phase 3: Mobile Review Submission & Product Detail Feed** — Overhauling `review.tsx` to restore the tri-state recommendation selector card (with Expyrico color tokens), removing the 1-to-5 star selector card, updating `reviews.tsx` with recommendation filter pills, and updating `[id].tsx` header.
4. **Phase 4: Mobile Review Display Cards & Section Overhaul** — Replacing star rows with recommendation badge pills in `ReviewCard`, `MyReviewCard`, and `ProductCommunityCard`, and replacing star average with `% recommend` and 3 counter pills in `ProductReviewsSection`.
5. **Phase 5: Admin Review Moderation & Analytics** — Updating review table columns, filter dropdowns, and detail cards in the Admin console to display recommendation sentiment rather than star ratings.
6. **Phase 6: Automated Testing & Verification** — Updating regression test suites across all packages and verifying local Android APK compilation with Gradle.

## Validation Status
- Plan directory validated via `ak plan validate`.
- Plan pinned via `ak plan use`.
- 24 tasks across 6 phases hydrated into the live task management surface.
