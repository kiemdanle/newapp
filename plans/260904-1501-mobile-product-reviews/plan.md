---
title: "Mobile Product Reviews: Creation, Reading, and Community Feedback Architecture"
description: "Comprehensive implementation plan to deliver full end-to-end mobile product review functionality: TanStack Query API client, 3-tier recommendation submission, product detail review section with helpfulness voting, and community reviews hub tab."
status: pending
priority: P1
effort: "2-3d"
tags: ["mobile", "reviews", "community", "products", "ratings", "api-integration"]
created: 2026-09-04
---

# Mobile Product Reviews: Creation, Reading, and Community Feedback Architecture

## Overview

Currently, the Expyrico platform features a fully-built backend reviews API (`/v1/products/:id/reviews`, `/v1/reviews/:id/helpful`, `/v1/me/reviews`) and admin moderation system, but the mobile app's review functionality is completely unwired:
1. Product details (`apps/mobile/app/(app)/product/[id].tsx`) contains no "Write a Review" entry point, no sentiment summary, and no reviews feed.
2. The review submission screen (`apps/mobile/app/(app)/product/[id]/review.tsx`) is an unwired stub (`// TODO: wire to API when M2 backend lands`) displaying a legacy 1–5 number row that contradicts the backend's tri-state recommendation contract (`buy_again` | `buy_again_on_sale` | `wont_buy`).
3. There is no mobile API client or TanStack Query hook layer (`apps/mobile/src/api/reviews.ts`).
4. The bottom navigation "Reviews" tab (`apps/mobile/app/(app)/(tabs)/reviews.tsx`) renders a static `EmptyState` placeholder with no user or community data.

This plan details the full implementation to bridge these gaps, delivering a polished, high-performance, accessible review experience compliant with Expyrico design guidelines (`docs/design/expyrico-colour-palette.md`).

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Create typed React Query API client `apps/mobile/src/api/reviews.ts` covering product reviews list, personal reviews, creation, edit, deletion, and helpful voting | P1 |
| 2 | Align `apps/mobile/app/(app)/product/[id]/review.tsx` to the tri-state recommendation contract (`Buy again`, `Buy on sale`, `Won't buy`), wire submission mutation, and handle edit state and moderation feedback | P1 |
| 3 | Integrate Reviews section onto Product Detail (`apps/mobile/app/(app)/product/[id].tsx`) with recommendation percentage banner, "Write/Edit Review" CTA, sorting pills, and interactive `ReviewCard` components with helpful voting | P1 |
| 4 | Transform `apps/mobile/app/(app)/(tabs)/reviews.tsx` into a dual-view Reviews Hub ("My Reviews" & "Community Picks") with infinite pagination, pull-to-refresh, and quick navigation | P1 |
| 5 | Comprehensive test suite (unit, component, snapshot) and on-device Android APK verification via Gradle toolchain | P1 |

## Phases Roadmap

| # | Phase | File | Status | Priority | Effort |
|---|-------|------|--------|----------|--------|
| 1 | Mobile API Client, Query Hooks, and Shared Types | [phase-01-mobile-api-client-and-types.md](./phase-01-mobile-api-client-and-types.md) | pending | P1 | 3-4h |
| 2 | Review Submission Flow and Sentiment Selector | [phase-02-review-submission-flow.md](./phase-02-review-submission-flow.md) | pending | P1 | 4-5h |
| 3 | Product Detail Screen Integration and Community Reviews Feed | [phase-03-product-detail-reviews-section.md](./phase-03-product-detail-reviews-section.md) | pending | P1 | 4-5h |
| 4 | Community and Personal Reviews Hub Tab | [phase-04-community-and-my-reviews-tab.md](./phase-04-community-and-my-reviews-tab.md) | pending | P1 | 3-4h |
| 5 | Automated Testing, APK Build, and Device Live Verification | [phase-05-testing-and-device-verification.md](./phase-05-testing-and-device-verification.md) | pending | P1 | 3-4h |

## Architecture & Data Flow

```
                      ┌────────────────────────────────────────┐
                      │    Product Details (product/[id].tsx)   │
                      │  - Recommendation % summary banner     │
                      │  - "Write Review" / "Edit Review" CTA  │
                      │  - Sort pills (Top helpful / Newest)   │
                      └───────┬────────────────────────┬───────┘
                              │                        │
       Taps "Write Review"    ▼                        ▼   Fetches reviews
        ┌───────────────────────────────┐     ┌────────────────────────────────┐
        │  Review Modal / Screen        │     │  useProductReviews(id, sort)   │
        │  (product/[id]/review.tsx)    │     └────────────────┬───────────────┘
        │  - [Buy again] [Sale] [Don't] │                      │
        │  - Optional body (<=2000 ch)  │                      ▼
        └──────────────┬────────────────┘     ┌────────────────────────────────┐
                       │                      │  ReviewCard components         │
      useCreateReview  │                      │  - Recommendation badge        │
      useUpdateReview  ▼                      │  - User avatar & name          │
        ┌───────────────────────────────┐     │  - Review text body            │
        │  POST /v1/products/:id/reviews│     │  - Helpful vote button & count │
        │  PATCH /v1/reviews/:id        │     └────────────────┬───────────────┘
        └──────────────┬────────────────┘                      │
                       │                                       ▼
                       │ Invalidates queries     ┌─────────────────────────────┐
                       └────────────────────────►│  POST /v1/reviews/:id/helpful│
                                                 └─────────────────────────────┘
```

## Key Technical Decisions & Guardrails

1. **Tri-State Recommendation Alignment**:
   - The backend schema (`packages/shared/src/schemas/review.ts`) defines:
     `rating: 'buy_again' | 'buy_again_on_sale' | 'wont_buy'`.
   - The UI replaces the 5-star number row with 3 distinct pill buttons styled per Expyrico palette tokens:
     - `Buy again`: Fresh Sage (`#4BAE8A`) with checkmark / thumbs-up.
     - `Buy on sale`: Honey (`#F5A623`) with discount tag.
     - `Won't buy`: Alert Red (`#E0442A`) with close / thumbs-down.

2. **Helpful Voting Contract**:
   - `POST /v1/reviews/:id/helpful` requires `{ "helpful": boolean }` and throws `422 REVIEW_HAS_NO_COMMENT` if the review has no body text.
   - The UI will only show the interactive helpful vote button when `review.body` is non-empty. For rating-only reviews, the helpful vote button is hidden.

3. **Optimistic Updates for Voting**:
   - Tapping "Helpful" applies immediate optimistic feedback to the local TanStack Query cache (incrementing `helpfulCount` and toggling `myVote`), with roll-back on mutation error.

4. **Query Invalidation Strategy**:
   - Submitting or updating a review invalidates `['product-reviews', productId]`, `['product', productId]`, and `['my-reviews']`.
   - Voting invalidates `['product-reviews', productId]`.

5. **Expyrico Color & Touch Targets**:
   - Minimum button touch targets $\ge 44\times 44\text{ pt}$ (`minHeight: 44`).
   - Clean status badges matching `docs/design/expyrico-colour-palette.md`.
