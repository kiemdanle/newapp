---
title: "Mobile Product Reviews: Creation, Reading, and Community Feedback Architecture"
description: "Comprehensive implementation plan to deliver full end-to-end mobile product review functionality: backend community feed endpoint, universal rate limiting across all review routes, product projection on personal reviews, review edit tally recalculation fix, queue job deduplication fix, distinct reporter auto-hide, database-validated optional auth, TanStack Query API client, 3-tier recommendation submission, product detail review section with authoritative product tallies and helpfulness voting, and reviews hub navigation."
status: pending
priority: P1
effort: "2-3d"
tags: ["mobile", "reviews", "community", "products", "ratings", "api-integration", "backend", "security", "rate-limiting"]
created: 2026-09-04
---

# Mobile Product Reviews: Creation, Reading, and Community Feedback Architecture

## Overview

Currently, the Expyrico platform features a partial backend reviews API (`/v1/products/:id/reviews`, `/v1/reviews/:id/helpful`, `/v1/me/reviews`) and admin moderation system, but the mobile app's review functionality is completely unwired, critical backend feeds and projections are missing, review routes lack rate limiting mandated by platform security rules, and review edits suffer from tally drift:
1. `GET /v1/me/reviews` currently returns `Review` objects with author projection only, missing `product` metadata (`name`, `brand`, `imageUrl`).
2. There is no general community reviews feed endpoint in the backend to power catalog-wide review discovery.
3. Review routes (`create.ts`, `list-for-product.ts`, `my-reviews.ts`, `update.ts`) currently have no rate limiting (`config.rateLimit`), violating the project's security mandate.
4. Review edits in `api/src/routes/reviews/update.ts` currently only enqueue product rating recalculations when `rating` changes, causing tally drift when `body` text presence changes or the profanity filter flags/unflags status.
5. In `api/src/queues/jobs/product-rating-recalc.ts:34`, a fixed deterministic `jobId` causes BullMQ to drop subsequent reviews for the same product as duplicates while the completed job is retained.
6. In `api/src/services/reports/repository.ts:40`, report auto-hide counts raw report rows rather than distinct reporters, allowing a single user to auto-hide reviews with 3 duplicate reports.
7. Product details (`apps/mobile/app/(app)/product/[id].tsx`) contains no "Write a Review" entry point, no sentiment summary, and no reviews feed.
8. The review submission screen (`apps/mobile/app/(app)/product/[id]/review.tsx`) is an unwired stub (`// TODO: wire to API when M2 backend lands`) displaying a legacy 1–5 number row that contradicts the backend's tri-state recommendation contract (`buy_again` | `buy_again_on_sale` | `wont_buy`).
9. There is no mobile API client or TanStack Query hook layer (`apps/mobile/src/api/reviews.ts`).
10. The bottom navigation does not register `ReviewsHub` in `TabsNavigator` or `AppNavigator`, leaving reviews screens disconnected from user navigation.

This plan details the full implementation across 6 structured phases to bridge these gaps, delivering a polished, high-performance, secure, and accessible review experience compliant with Expyrico design guidelines (`docs/design/expyrico-colour-palette.md`).

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Extend backend shared contracts, add Prisma composite indexes, fix BullMQ recalc queue deduplication, fix review status drift, enforce distinct reporter auto-hide, validate optionalAuth credentials, project `product` metadata onto `GET /v1/me/reviews`, build `GET /v1/products/:id/my-review` and `GET /v1/reviews/community` feed endpoints, and enforce rate limits across all review routes | P1 |
| 2 | Create typed React Query API client `apps/mobile/src/api/reviews.ts` covering product reviews list, community reviews, personal reviews, authoritative own-review query, creation, edit, deletion, helpful voting (`ReviewHelpful`), and exact cache invalidation of `['products', productId]` | P1 |
| 3 | Align `apps/mobile/app/(app)/product/[id]/review.tsx` to the tri-state recommendation contract (`Buy again`, `Buy on sale`, `Won't buy` using neutral Stone/Pebble/Almost Black, strictly avoiding Alert Red), wire submission mutation, support `body: null` comment clearing, and handle edit state and moderation feedback | P1 |
| 4 | Integrate Reviews section onto Product Detail (`apps/mobile/app/(app)/product/[id].tsx`) with recommendation percentage banner derived authoritatively using `product.ratingCount` as denominator, "Write/Edit Review" CTA, sorting pills (`Top helpful` & `Newest`), and interactive `ReviewCard` components with helpful voting | P1 |
| 5 | Register `ReviewsHub` in `AppNavigator.tsx` and integrate navigation entry points from `ProfileScreen` and Product Details, providing dual-view feeds ("My Reviews" & "Community Picks") with infinite pagination, pull-to-refresh, and quick navigation | P1 |
| 6 | Comprehensive test suite (backend integration, 429 rate limit tests, tally drift transition tests, mobile unit, component, snapshot) and on-device Android APK verification via Gradle toolchain | P1 |

## Phases Roadmap

| # | Phase | File | Status | Priority | Effort |
|---|-------|------|--------|----------|--------|
| 1 | Backend Contracts, Migration, Recalc Queue Fix, Community Feed, and Universal Rate Limiting | [phase-01-backend-contracts-and-community-feed.md](./phase-01-backend-contracts-and-community-feed.md) | pending | P1 | 4-5h |
| 2 | Mobile API Client, Query Hooks, and Cache Invalidation | [phase-02-mobile-api-client-and-query-hooks.md](./phase-02-mobile-api-client-and-query-hooks.md) | pending | P1 | 3-4h |
| 3 | Review Submission Flow and Sentiment Selector | [phase-03-review-submission-flow.md](./phase-03-review-submission-flow.md) | pending | P1 | 4-5h |
| 4 | Product Detail Screen Integration and Community Reviews Feed | [phase-04-product-detail-reviews-section.md](./phase-04-product-detail-reviews-section.md) | pending | P1 | 4-5h |
| 5 | Reviews Hub Screen, Navigation Registration, and Community Feed | [phase-05-community-and-my-reviews-tab.md](./phase-05-community-and-my-reviews-tab.md) | pending | P1 | 3-4h |
| 6 | Automated Testing, APK Build, and Device Live Verification | [phase-06-testing-and-device-verification.md](./phase-06-testing-and-device-verification.md) | pending | P1 | 3-4h |

## Architecture & Data Flow

```
                      ┌────────────────────────────────────────┐
                      │    Product Details (product/[id].tsx)   │
                      │  - Authoritative counts from Product   │
                      │    (buyAgainCount, ratingCount, etc.)  │
                      │  - "Write Review" / "Edit Review" CTA  │
                      │  - Sort pills (Top helpful / Newest)   │
                      └───────┬────────────────────────┬───────┘
                              │                        │
       Taps "Write Review"    ▼                        ▼   Fetches reviews
        ┌───────────────────────────────┐     ┌────────────────────────────────┐
        │  Review Modal / Screen        │     │  useProductReviews(id, sort)   │
        │  (product/[id]/review.tsx)    │     └────────────────┬───────────────┘
        │  - useMyProductReview(id)     │                      │
        │  - [Buy again] [Sale] [Don't] │                      ▼
        │  - Optional body (<=2000 ch)  │     ┌────────────────────────────────┐
        └──────────────┬────────────────┘     │  ReviewCard components         │
                       │                      │  - Recommendation badge        │
      useCreateReview  │                      │  - User avatar & name          │
      useUpdateReview  ▼                      │  - Review text body            │
        ┌───────────────────────────────┐     │  - Helpful vote button & count │
        │  POST /v1/products/:id/reviews│     └────────────────┬───────────────┘
        │  PATCH /v1/reviews/:id        │                      │
        └──────────────┬────────────────┘                      │
                       │                                       ▼
                       │ Invalidates ['products', id] ┌─────────────────────────────┐
                       └─────────────────────────────►│  POST /v1/reviews/:id/helpful│
                                                      └─────────────────────────────┘
```

## Key Technical Decisions & Guardrails

1. **Authoritative Sentiment Counters & Correct Math**:
   - The authoritative aggregate counts already live directly on the `Product` model in Postgres (`buyAgainCount`, `buyAgainOnSaleCount`, `wontBuyCount`, `ratingCount`, `reviewCount`).
   - In `processProductRatingRecalc`:
     `ratingCount` is the total count of all 3 recommendation sentiments (`buy_again + buy_again_on_sale + wont_buy`).
     `reviewCount` counts entries with a non-null comment (`body != null`).
   - **Math Formula**: Must use `ratingCount` as the denominator to prevent >100% ratios:
     ```typescript
     const totalRatings = product.ratingCount ?? 0;
     const positiveRecommendations = (product.buyAgainCount ?? 0) + (product.buyAgainOnSaleCount ?? 0);
     const recommendPct = totalRatings > 0 ? Math.round((positiveRecommendations / totalRatings) * 100) : null;
     const writtenReviewsCount = product.reviewCount ?? 0;
     ```
   - Subtitle copy displays: `"${recommendPct}% Recommend this product · ${totalRatings} ratings (${writtenReviewsCount} written reviews)"`.
   - **Never compute sentiment percentages from one paginated slice of reviews**, which introduces sample bias.

2. **Distinct Reporter Auto-Hide & Security Controls**:
   - `api/src/services/reports/repository.ts` counts distinct `reporterId` values for auto-hiding reviews, preventing single-user duplicate reporting abuse.
   - `api/src/plugins/auth.ts` implements `optionalAuth` that validates database `tokenVersion` and active status, preventing revoked tokens from receiving owner privileges.
   - Separate `reviewCreateSchema` and `reviewPatchSchema`: PATCH accepts `string | null | undefined`, where `null` explicitly clears the comment text.

3. **Universal Rate Limiting (Security Mandate)**:
   - Apply rate limiting to every review endpoint:
     - Read endpoints (`GET /products/:id/reviews`, `GET /me/reviews`, `GET /reviews/community`, `GET /products/:id/my-review`): 60/minute.
     - Write endpoints (`POST /products/:id/reviews`, `PATCH /reviews/:id`, `DELETE /reviews/:id`): 15/minute.
     - Vote endpoints (`POST /reviews/:id/helpful`, `DELETE /reviews/:id/helpful`): 30/minute.
   - Verified via dedicated 429 integration tests in `api/tests/integration/reviews-rate-limits.test.ts`.

4. **Accurate Query Key Invalidation**:
   - The hook `useProduct(id)` in `apps/mobile/src/api/products.ts:42` is bound to query key `['products', id]`.
   - All review mutations (`useCreateReview`, `useUpdateReview`, `useDeleteReview`) MUST invalidate:
     - `['products', productId]` (ensuring product detail counters refresh immediately).
     - `['product-reviews', productId]`
     - `['my-product-review', productId]`
     - `['my-reviews']`
     - `['community-reviews']`

5. **Strict Expyrico Palette Adherence (No Alert Red on Recommendations)**:
   - Alert Red (`#E0442A`) is reserved strictly for Expired and Destructive states per `docs/design/expyrico-colour-palette.md`. Recommendation sentiments are neither.
   - Recommendation states must resolve to:
     - `buy_again`: Fresh Sage (`#4BAE8A`) with Mint Mist (`#D6F0E6`).
     - `buy_again_on_sale`: Honey (`#F5A623`) with Soft Butter (`#FEEFC3`).
     - `wont_buy`: Neutral Stone (`#F0F0ED`) background, Pebble (`#8C8C85`) border, and Almost Black (`#2C2C28`) text with a thumbs-down icon. (Zero Alert Red).

6. **Dedicated Backend Community Feed & Global Composite Indexes**:
   - `GET /v1/reviews/community` is implemented with active-product and visibility filters.
   - Database migration adds `@@index([status, score(sort: Desc), id(sort: Desc)])` and `@@index([status, createdAt(sort: Desc), id(sort: Desc)])`.
   - Uses deterministic keyset pagination with `id` tie-breaker.
   - `GET /v1/me/reviews` projects `product: { id, name, brand, imageUrl }` so personal review cards render product metadata.

7. **Helpful Voting Contract**:
   - Validates `ReviewHelpful` (`{ helpful: boolean }`) for POST.
   - Server-side check rejects author self-votes with `403 FORBIDDEN`.
   - Binary toggle: Tapping Helpful button toggles helpfulness on/off (`POST { helpful: true }` / `DELETE /reviews/:id/helpful`).
   - The UI hides the helpful button when `review.body` is null (`422 REVIEW_HAS_NO_COMMENT`) or when viewer is the review's author.
   - Optimistic cache updates on the local TanStack Query cache provide instant feedback with zero network latency.

8. **Touch Targets & Android Back Handling**:
   - All interactive touch targets meet the $\ge 44\times 44\text{ pt}$ rule (`minHeight: 44`).
   - Hardware back button on Android cleanly dismisses modals with unsaved changes confirmation.

---

## Red Team Review

### Session — 2026-09-04
**Findings:** 12 (12 accepted, 0 rejected)
**Severity breakdown:** 3 Critical, 8 High, 1 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Recalc Queue Fixed Job ID Freezes Tallies | Critical | Accept | Phase 1 (`product-rating-recalc.ts`) |
| 2 | Review Status Writers Lack Recalculation (Admin Status, Reports Auto-Hide) | Critical | Accept | Phase 1 (`update.ts`, `status.ts`, `repository.ts`) |
| 3 | Single User Can Auto-Hide Reviews via Duplicate Reports | Critical | Accept | Phase 1 (`reports/repository.ts`) |
| 4 | Empty-String Comments Corrupt `reviewCount` and Enter Community Feed | High | Accept | Phase 1 (`review.ts`, `create.ts`, `update.ts`) |
| 5 | Review Patch Cannot Clear Comments (z.string rejects null) | High | Accept | Phase 1 (`review.ts`) & Phase 3 |
| 6 | Revoked Credentials Can Access Hidden Reviews via Optional Auth | High | Accept | Phase 1 (`plugins/auth.ts`) |
| 7 | Server-Side Self-Vote Prevention Missing | High | Accept | Phase 1 (`helpful.ts`) |
| 8 | Reviews Hub is Not Registered in `AppNavigator` | High | Accept | Phase 5 (`AppNavigator.tsx`, `profile.tsx`) |
| 9 | Authoritative Own Review Endpoint (`GET /v1/products/:id/my-review`) & Idempotent Create | High | Accept | Phase 1 (`my-review.ts`, `create.ts`) & Phase 3 |
| 10 | Helpful Voting Uses `ReviewHelpful` Payload & Prevents Concurrency Double-Taps | High | Accept | Phase 2 (`reviews.ts`) & Phase 4 |
| 11 | Universal Rate Limiting Coverage on Read Routes | High | Accept | Phase 1 (`rate-limits.ts`, `community.ts`, etc.) |
| 12 | Remove Artificial Fallback QueryClient | Medium | Accept | Phase 2 (`reviews.ts`) |

### Whole-Plan Consistency Sweep
- **Stale terms / conflicts**: 0
- **Contradictions resolved**:
  - Distinct reporter auto-hide added to Phase 1 (`reports/repository.ts`).
  - Optional auth token-version validation added to Phase 1 (`plugins/auth.ts`).
  - Separate create/patch body schemas added to Phase 1 (`packages/shared/src/schemas/review.ts`).
  - Clear comment semantics (`body: null`) integrated into Phase 3 (`review.tsx`).
  - Reconciled all review queue references to unique job IDs.
  - Aligned all sort references across all phases strictly to `'score' | 'new'`.
  - Reconciled all voting payload types to `ReviewHelpful` (`{ helpful: boolean }`).
  - Reconciled all palette references to exclude Alert Red and use neutral Stone/Pebble for `wont_buy`.
  - Reconciled query invalidation to `['products', productId]` (plural) to refresh authoritative `Product` fields.
  - Linked `ReviewsHub` to `AppNavigator.tsx` and `profile.tsx` ActionRow.
- **Unresolved contradictions**: 0
