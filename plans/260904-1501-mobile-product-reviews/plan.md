---
title: "Mobile Product Reviews: Creation, Reading, and Community Feedback Architecture"
description: "Comprehensive implementation plan to deliver full end-to-end mobile product review functionality: backend community feed endpoint, database-enforced report concurrency protection, synchronous product tally durability with strict lock ordering, universal rate limiting across all review routes, product projection on personal reviews, distinct reporter auto-hide, database-validated optional auth, TanStack Query API client, 3-tier recommendation submission, product detail review section with authoritative product tallies and helpfulness voting, and reviews hub navigation."
status: pending
priority: P1
effort: "2-3d"
tags: ["mobile", "reviews", "community", "products", "ratings", "api-integration", "backend", "security", "rate-limiting"]
created: 2026-09-04
---

# Mobile Product Reviews: Creation, Reading, and Community Feedback Architecture

## Overview

Currently, the Expyrico platform features a partial backend reviews API (`/v1/products/:id/reviews`, `/v1/reviews/:id/helpful`, `/v1/me/reviews`) and admin moderation system, but the mobile app's review functionality is completely unwired, critical backend feeds and projections are missing, review routes lack rate limiting mandated by platform security rules, and product tallies suffer from asynchronous queue drift:
1. `GET /v1/me/reviews` currently returns `Review` objects with author projection only, missing `product` metadata (`name`, `brand`, `imageUrl`).
2. There is no general community reviews feed endpoint in the backend to power catalog-wide review discovery.
3. Review routes (`create.ts`, `list-for-product.ts`, `my-reviews.ts`, `update.ts`) currently have no rate limiting (`config.rateLimit`), violating the project's security mandate.
4. Review mutations currently rely on an asynchronous fire-and-forget Redis queue that permanently loses recalculations during Redis outages or races immediate mobile refetches.
5. Report auto-hide currently counts raw report rows rather than distinct reporters, and duplicate open reports can be inserted concurrently without a database-level uniqueness constraint.
6. Product details (`apps/mobile/app/(app)/product/[id].tsx`) contains no "Write a Review" entry point, no sentiment summary, and no reviews feed.
7. The review submission screen (`apps/mobile/app/(app)/product/[id]/review.tsx`) is an unwired stub (`// TODO: wire to API when M2 backend lands`) displaying a legacy 1–5 number row that contradicts the backend's tri-state recommendation contract (`buy_again` | `buy_again_on_sale` | `wont_buy`).
8. There is no mobile API client or TanStack Query hook layer (`apps/mobile/src/api/reviews.ts`).
9. The bottom navigation does not register `ReviewsHub` in `TabsNavigator` or `AppNavigator`, leaving reviews screens disconnected from user navigation.

This plan details the full implementation across 6 structured phases to bridge these gaps, delivering a polished, high-performance, secure, and accessible review experience compliant with Expyrico design guidelines (`docs/design/expyrico-colour-palette.md`).

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Extend backend shared contracts, add Prisma composite indexes and partial unique constraint on open reports, update product tallies synchronously with strict lock ordering, serialize vote recounting with row locking, enforce distinct reporter auto-hide, validate optionalAuth credentials, gate product visibility, project `product` metadata onto `GET /v1/me/reviews`, build `GET /v1/products/:id/my-review` and `GET /v1/reviews/community` feed endpoints, and enforce rate limits across all review routes | P1 |
| 2 | Create typed React Query API client `apps/mobile/src/api/reviews.ts` covering product reviews list, community reviews, personal reviews, authoritative own-review query, creation, edit, deletion, helpful voting (`ReviewHelpful`), client-side review ID deduplication, in-flight mutexing, and exact cache invalidation of `['products', productId]` | P1 |
| 3 | Align `apps/mobile/app/(app)/product/[id]/review.tsx` to the tri-state recommendation contract (`Buy again`, `Buy on sale`, `Won't buy` using neutral Stone/Pebble/Almost Black, strictly avoiding Alert Red), wire submission mutation, support `body: null` comment clearing, and handle edit state and moderation feedback | P1 |
| 4 | Integrate Reviews section onto Product Detail (`apps/mobile/app/(app)/product/[id].tsx`) with recommendation percentage banner derived authoritatively using `product.ratingCount` as denominator, "Write/Edit Review" CTA, sorting pills (`Top helpful` & `Newest`), and interactive `ReviewCard` components consuming sanitized public DTOs with `isOwnReview` | P1 |
| 5 | Register `ReviewsHub` in `AppNavigator.tsx` and integrate navigation entry points from `ProfileScreen` and Product Details, providing dual-view feeds ("My Reviews" & "Community Picks") with infinite pagination, pull-to-refresh, and quick navigation | P1 |
| 6 | Comprehensive test suite (backend integration, 429 rate limit tests, report concurrency tests, tally concurrency tests, mobile unit, component, snapshot) and on-device Android APK verification via Gradle toolchain | P1 |

## Phases Roadmap

| # | Phase | File | Status | Priority | Effort |
|---|-------|------|--------|----------|--------|
| 1 | Backend Contracts, Migration, Synchronous Tally Durability, and Security Hardening | [phase-01-backend-contracts-and-community-feed.md](./phase-01-backend-contracts-and-community-feed.md) | pending | P1 | 4-5h |
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
      useCreateReview  │                      │  - Author {firstName, avatar}  │
      useUpdateReview  ▼                      │  - Review text body            │
        ┌───────────────────────────────┐     │  - isOwnReview gate            │
        │  POST /v1/products/:id/reviews│     │  - Helpful vote button & count │
        │  PATCH /v1/reviews/:id        │     └────────────────┬───────────────┘
        │  (Synchronous tally update:   │                      │
        │   Product row locked FIRST)   │                      ▼
        └──────────────┬────────────────┘     ┌────────────────────────────────┐
                       │                      │  POST /v1/reviews/:id/helpful  │
                       │ Invalidates          │  (SELECT FOR UPDATE on Review) │
                       │ ['products', id]     └────────────────────────────────┘
                       ▼
        ┌───────────────────────────────┐
        │  Product tallies fresh        │
        │  immediately on refetch       │
        └───────────────────────────────┘
```

## Key Technical Decisions & Guardrails

1. **Synchronous Product Tally Durability & Strict Lock Ordering**:
   - Instead of fire-and-forget Redis queues that lose tallies during Redis outages or race immediate mobile cache refetches, review mutations (`createReviewRoute`, `updateReviewRoute`), admin moderation, and report auto-hide execute `syncProductRatingTallies(tx, productId)` inside the same Postgres transaction.
   - **Lock Ordering**: Every write path locks the `Product` row first (`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`), then mutates the `Review` row, then recomputes and writes tallies on `Product` in that same transaction. This serializes all concurrent review writes for the same product and eliminates deadlocks.
   - The BullMQ worker `product-rating-recalc.ts` is retained strictly as an optional maintenance/reconciliation task, but is completely bypassed for live mutations.

2. **Vote Recount Concurrency Serialization**:
   - `recomputeReviewScore` inside `api/src/services/reviews/repository.ts` executes `SELECT id FROM reviews WHERE id = ${reviewId}::uuid FOR UPDATE` before running `groupBy` on `reviewVote`. This serializes concurrent votes on the same review and prevents stale snapshot overwrites.

3. **Authoritative Sentiment Counters & Correct Math**:
   - In `Product`, `ratingCount` is the total count of all 3 recommendation sentiments (`buy_again + buy_again_on_sale + wont_buy`).
   - `reviewCount` counts entries with a non-null comment (`body != null`).
   - **Math Formula**: Must use `ratingCount` as the denominator to prevent >100% ratios:
     ```typescript
     const totalRatings = product.ratingCount ?? 0;
     const positiveRecommendations = (product.buyAgainCount ?? 0) + (product.buyAgainOnSaleCount ?? 0);
     const recommendPct = totalRatings > 0 ? Math.round((positiveRecommendations / totalRatings) * 100) : null;
     const writtenReviewsCount = product.reviewCount ?? 0;
     ```
   - Subtitle copy displays: `"${recommendPct}% Recommend this product · ${totalRatings} ratings (${writtenReviewsCount} written reviews)"`.

4. **Distinct Reporter Auto-Hide & Concurrency Protection**:
   - `api/src/services/reports/repository.ts` counts distinct `reporterId` values where `status in ['open', 'resolved']`. Auto-hiding strictly requires `distinctReporters.length > AUTO_HIDE_REPORT_THRESHOLD` (preserves spec §2.8 threshold of $>3$, on the 4th distinct reporter).
   - Database partial unique index `reports_open_per_reporter_target_idx` on `(reporter_id, target_type, target_id) WHERE status = 'open'` prevents concurrent duplicate open reports, mapping `P2002` to `409 CONFLICT`.
   - `api/src/plugins/auth.ts` implements `optionalAuth` that validates database `tokenVersion` and active status, preventing revoked tokens from receiving owner privileges.
   - Separate `reviewCreateSchema` and `reviewPatchSchema`: PATCH accepts `string | null | undefined`, where `null` explicitly clears the comment text.

5. **Type-Safe Product Visibility & Sanitized Public DTO**:
   - `GET /products/:id/reviews` branches type-safely:
     - Authenticated: calls `getVisibleProduct({ id: req.user.id, role: req.user.role }, productId)`.
     - Anonymous: calls `resolveCanonicalProduct` and verifies status is `'active'`.
   - Public review responses omit both top-level internal `userId` AND `author.id`, projecting `author: { firstName, avatarUrl }` and server-derived `isOwnReview: boolean`.
   - Helpful endpoint supports thumbs-up only (`{ helpful: true }` and `DELETE`), rejecting author self-votes with `403 FORBIDDEN`.

6. **Universal Rate Limiting (Security Mandate)**:
   - Apply rate limiting to every review endpoint:
     - Read endpoints (`GET /products/:id/reviews`, `GET /me/reviews`, `GET /reviews/community`, `GET /products/:id/my-review`): 60/minute.
     - Write endpoints (`POST /products/:id/reviews`, `PATCH /reviews/:id`, `DELETE /reviews/:id`): 15/minute.
     - Vote endpoints (`POST /reviews/:id/helpful`, `DELETE /reviews/:id/helpful`): 30/minute.
   - Verified via dedicated 429 integration tests in `api/tests/integration/reviews-rate-limits.test.ts`.

7. **Accurate Query Key Invalidation & Concurrency Protection**:
   - The hook `useProduct(id)` in `apps/mobile/src/api/products.ts:42` is bound to query key `['products', id]`.
   - All review mutations (`useCreateReview`, `useUpdateReview`, `useDeleteReview`) invalidate `['products', productId]`, `['product-reviews', productId]`, `['my-product-review', productId]`, `['my-reviews']`, and `['community-reviews']`.
   - `useVoteReviewHelpful` maintains an in-flight review mutex (`votingReviewIds`), calls `cancelQueries` before snapshotting, and reconciles on `onSettled`.
   - `deduplicateReviews` pure helper deduplicates review IDs across infinite query pages to absorb mutable-score shifts gracefully.

8. **Strict Expyrico Palette Adherence (No Alert Red on Recommendations)**:
   - Alert Red (`#E0442A`) is reserved strictly for Expired and Destructive states per `docs/design/expyrico-colour-palette.md`. Recommendation sentiments are neither.
   - Recommendation states must resolve to:
     - `buy_again`: Fresh Sage (`#4BAE8A`) with Mint Mist (`#D6F0E6`).
     - `buy_again_on_sale`: Honey (`#F5A623`) with Soft Butter (`#FEEFC3`).
     - `wont_buy`: Neutral Stone (`#F0F0ED`) background, Pebble (`#8C8C85`) border, and Almost Black (`#2C2C28`) text with a thumbs-down icon. (Zero Alert Red).

9. **Dedicated Backend Community Feed & Global Composite Indexes**:
   - `GET /v1/reviews/community` is implemented with active-product and visibility filters.
   - Database migration adds `@@index([status, score(sort: Desc), id(sort: Desc)])` and `@@index([status, createdAt(sort: Desc), id(sort: Desc)])`.
   - Uses deterministic keyset pagination with `id` tie-breaker.
   - `GET /v1/me/reviews` projects `product: { id, name, brand, imageUrl }` so personal review cards render product metadata.

10. **Touch Targets & Android Back Handling**:
   - All interactive touch targets meet the $\ge 44\times 44\text{ pt}$ rule (`minHeight: 44`).
   - Hardware back button on Android cleanly dismisses modals with unsaved changes confirmation.

---

## Red Team Review

### Session — 2026-09-04
**Findings:** 15 (15 accepted, 0 rejected)
**Severity breakdown:** 4 Critical, 11 High

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Product Tally Durability & Lock Ordering | Critical | Accept | Phase 1 (`product-tallies.ts`, `create.ts`, `update.ts`): Replaced fire-and-forget Redis queue with synchronous `SELECT FOR UPDATE` on `Product` locked *first* before review mutation, ensuring immediate consistency. |
| 2 | Vote Recount Concurrency Race on Un-Locked Review | Critical | Accept | Phase 1 (`services/reviews/repository.ts`): Inside `recomputeReviewScore`, execute `SELECT id FROM reviews WHERE id = ${reviewId}::uuid FOR UPDATE` before `groupBy` to serialize concurrent votes. |
| 3 | Database-Level Concurrency Hole on Duplicate Open Reports | Critical | Accept | Phase 1 (`schema.prisma` migration & `reports/create.ts`): Added partial unique index `reports_open_per_reporter_target_idx` on `(reporter_id, target_type, target_id) WHERE status = 'open'`, mapping `P2002` to 409 Conflict. |
| 4 | Distinct Reporter Auto-Hide Semantics | Critical | Accept | Phase 1 (`reports/repository.ts`): `maybeAutoHide` groups by `reporterId` across `status in ['open', 'resolved']`, auto-hiding strictly when `distinct > 3` (preserving spec §2.8 threshold). |
| 5 | Mutable-Score Cursor Drift on Infinite Scroll | High | Accept | Phase 2 (`api/reviews.ts`): Added `deduplicateReviews` helper using `Set<string>` over `review.id` to absorb live Wilson score shifts across pages without duplicate cards. |
| 6 | In-Flight Helpful Vote Double-Tap Concurrency | High | Accept | Phase 2 (`api/reviews.ts`): Added in-flight mutex (`votingReviewIds`), `cancelQueries` before snapshotting, and `onSettled` reconciliation in `useVoteReviewHelpful`. |
| 7 | Empty-String Comments Corrupt `reviewCount` | High | Accept | Phase 1 (`review.ts`, `create.ts`, `update.ts`): Trimmed empty or whitespace-only text normalizes to `null`, ensuring accurate `reviewCount` and community filtering. |
| 8 | Review Patch Cannot Clear Comments (z.string rejects null) | High | Accept | Phase 1 (`review.ts`) & Phase 3: Separated `reviewCreateSchema` and `reviewPatchSchema` (accepts `string \| null \| undefined`, where `null` clears the comment). |
| 9 | Product-Visibility Gating Missing on Review Lists | High | Accept | Phase 1 (`list-for-product.ts`): Type-safe visibility check branching for authenticated (`getVisibleProduct`) and anonymous (canonical active status) visitors. |
| 10 | Stealth Downvote API Exposing Hidden Ranking Depression | High | Accept | Phase 1 (`helpful.ts`): Restricted `POST /v1/reviews/:id/helpful` to `{ helpful: true }` and `DELETE` to remove, eliminating negative ranking depression. |
| 11 | Public Review DTO Exposes Internal User UUIDs | High | Accept | Phase 1 (`review.ts`, `repository.ts`) & Phase 4: Public review DTO omits both top-level `userId` AND `author.id`, projecting `author: { firstName, avatarUrl }` and server-derived `isOwnReview: boolean`. In Phase 4, `ReviewCard` uses `!review.isOwnReview`. |
| 12 | Revoked Credentials Can Access Hidden Reviews via Optional Auth | High | Accept | Phase 1 (`plugins/auth.ts`): Added `app.optionalAuth` validating database `tokenVersion` and active status when Bearer header is present. |
| 13 | Server-Side Self-Vote Prevention Missing | High | Accept | Phase 1 (`helpful.ts`): Added server check `review.userId === req.user.id` throwing `403 FORBIDDEN`. |
| 14 | Reviews Hub is Not Registered in `AppNavigator` | High | Accept | Phase 5 (`AppNavigator.tsx`, `profile.tsx`): Registered `<Stack.Screen name="ReviewsHub" component={ReviewsHubScreen} />` with entry points from `ProfileScreen` and Product Details. |
| 15 | Authoritative Own Review Endpoint (`GET /v1/products/:id/my-review`) & Idempotent Create | High | Accept | Phase 1 (`my-review.ts`, `create.ts`) & Phase 3: Added `GET /v1/products/:id/my-review` returning `{ review: Review \| null }`, with `config: { idempotent: 'required' }` on create. |

### Whole-Plan Consistency Sweep
- **Stale terms / conflicts**: 0
- **Contradictions resolved**:
  - Replaced all lossy BullMQ recalc queue claims with synchronous transactional tally updates with strict lock ordering (`SELECT FOR UPDATE` on `Product` locked *first*).
  - Addressed vote recount race with `SELECT FOR UPDATE` on `Review`.
  - Type-safe anonymous and authenticated visibility branching specified for `list-for-product.ts`.
  - Public review DTO sanitizes both `userId` and `author.id`, projecting `author: { firstName, avatarUrl }` and `isOwnReview: boolean`.
  - Phase 4 `ReviewCard` consumes `!review.isOwnReview` and requires no `userId`/`currentUserId` props.
  - Helpful voting concurrency protected with in-flight mutex, `cancelQueries`, snapshot toggle, and `onSettled` invalidation.
  - Auto-hide semantics preserved: counts distinct `reporterId` values across `status in ['open', 'resolved']`, triggering strictly when `distinct > 3` (preserving spec §2.8 threshold).
  - Database partial unique index on open reports added to migration.
  - Aligned all sort references across all phases strictly to `'score' | 'new'`.
  - Reconciled all palette references to exclude Alert Red and use neutral Stone/Pebble for `wont_buy`.
  - Reconciled query invalidation to `['products', productId]` (plural) to refresh authoritative `Product` fields.
  - Linked `ReviewsHub` to `AppNavigator.tsx` and `profile.tsx` ActionRow.
- **Unresolved contradictions**: 0
