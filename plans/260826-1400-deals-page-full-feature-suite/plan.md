---
title: "Deals Page Full Feature Suite"
description: "End-to-end implementation of the Deals feature in Expyrico mobile app and backend API: adding deals with mandatory photo proof, barcode scanner and product selector, real-time search, multi-faceted filtering, sorting, deal editing, and rich details."
status: completed
priority: P1
branch: "main"
tags: [deals, mobile, api, search, filter, sort, tdd]
blockedBy: []
blocks: []
created: "2026-08-26T06:20:31.086Z"
createdBy: "ck:plan"
source: skill
---

# Deals Page Full Feature Suite

## Executive Summary

The Deals feature in Expyrico allows users to discover, share, vote on, and save money on community-sourced grocery discounts and clearance items before they expire. Currently, the Deals tab in `apps/mobile/app/(app)/(tabs)/deals.tsx` is an empty skeleton without the ability to add new deals, search products, apply filters, sort by price or expiration date, or edit existing deals.

This plan delivers a complete, production-ready Deals experience covering:
1. **Adding & Editing Deals**: Header and Floating Action Button (FAB), mandatory photo proof attachment (receipt or shelf price tag to combat spam), barcode scanner integration, community catalog product search, pantry item picker, date picker modal, and complete deal update/delete support (fixing the `editId` ignored parameter bug).
2. **Finding & Real-time Search**: Debounced search bar querying product name, brand, store name, and notes.
3. **Advanced Filtering**: Filter modal and active chips for Store name (Hybrid: curated chains like Trader Joe's, ALDI, Walmart, Costco, Target, Whole Foods + dynamic user stores), Price ranges (e.g. Under $5, $5-$15, $15-$30, Custom), Expiry status (All, Unexpired only, Expiring in 7 days), and Country scope (Local first with global fallback).
4. **Comprehensive Sorting**: Sorting pills and sheet options for Top Rated (`score`), Newest (`new`), Lowest Price (`price_asc`), Highest Price (`price_desc`), and Expiring Soonest (`expiry_asc`).
5. **Polished Expyrico UI & Performance**: Expyrico design system colors (Fresh Sage `#4BAE8A`, Deep Sage `#3A8F6F`, Honey `#F5A623`, Mint Mist `#D6F0E6`, Warm White `#FAFAF8`, Alert Red `#E0442A`), pull-to-refresh, optimistic voting, rich Deal Detail screen with native sharing, and comprehensive automated test suites.

---

## Architectural Overview & Data Flow

```
+-----------------------------------------------------------------------------------+
|                               Mobile Application                                  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                     DealsTabScreen (Feed & Controls)                        |  |
|  |  [ Search Bar (Debounced) ] [ Filter Button (Badge) ] [ Sort Selector ]    |  |
|  |  [ Active Filter Chips (Clearable) ]                                        |  |
|  |  +-----------------------------------------------------------------------+  |  |
|  |  | FlatList (Pull-to-Refresh, Infinite Pagination via TanStack Query)     |  |  |
|  |  | - DealCard (Image, Price, Store Pill, Expiry Badge, Votes, Author)    |  |  |
|  |  | - EmptyState (Differentiated: No results vs No deals in area)           |  |  |
|  |  +-----------------------------------------------------------------------+  |  |
|  |  [ Floating Action Button: + Post Deal ]                                    |  |
|  +-----------------------------------------------------------------------------+  |
|          |                            |                               |           |
|          v                            v                               v           |
|  +-------------------+      +-------------------+           +------------------+  |
|  |  DealFilterModal  |      |   NewDealScreen   |           | DealDetailScreen |  |
|  | - Store Facets    |      | - Barcode Scanner |           | - Product Hero   |  |
|  | - Price Ranges    |      | - Catalog Search  |           | - Mandatory Photo|  |
|  | - Expiry Status   |      | - Pantry Picker   |           | - Store & Expiry |  |
|  | - Country Scope   |      | - DealForm (Edit) |           | - Edit / Delete  |  |
|  +-------------------+      +-------------------+           +------------------+  |
+-----------------------------------------------------------------------------------+
                                        | (HTTPS / REST)
                                        v
+-----------------------------------------------------------------------------------+
|                                Fastify API Backend                                |
|                                                                                   |
|  GET   /v1/deals          -> Advanced Search, Filter (Store, Price, Expiry), Sort |
|  GET   /v1/deals/stores   -> Hybrid store facets (Curated + Dynamic, Rate-limited)|
|  GET   /v1/deals/:id      -> Single deal with product, author, vote relations     |
|  POST  /v1/deals          -> Create deal (Mandatory photo proof, Idempotent)      |
|  PATCH /v1/deals/:id      -> Update deal (Author only, Zod validated)             |
|  DELETE/v1/deals/:id      -> Soft/Hard delete deal (Author or Admin)              |
|  POST  /v1/deals/:id/vote -> Upvote (+1) / Downvote (-1) & Wilson score recalc    |
|                                                                                   |
|  Prisma ORM + PostgreSQL Database (Indexed on [status, score], [status, price])  |
+-----------------------------------------------------------------------------------+
```

---

## Phases Roadmap

| Phase | Title | Priority | Dependencies | Status |
|---|---|---|---|---|
| **1** | [Shared Schemas & Contracts](./phase-01-shared-schemas-contracts.md) | P1 | None | Completed |
| **2** | [Backend API Search & Filters](./phase-02-backend-api-search-filters.md) | P1 | Phase 1 | Completed |
| **3** | [Mobile API Client & Hooks](./phase-03-mobile-api-client-hooks.md) | P1 | Phase 1, Phase 2 | Completed |
| **4** | [Mobile DealFeed Search & Filters](./phase-04-mobile-dealfeed-search-filters.md) | P1 | Phase 3 | Completed |
| **5** | [Mobile Deal Creation & Detail Flows](./phase-05-mobile-deal-creation-detail-flows.md) | P1 | Phase 3, Phase 4 | Completed |
| **6** | [Testing & Verification](./phase-06-testing-verification.md) | P1 | Phase 1–5 | Completed |

---

## Risk Assessment & Mitigations

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| **Query Performance Degradation** with full-text search & multiple filters on PostgreSQL | Medium | Add composite indexes on `deals(status, country, created_at)`, `deals(status, price)`, `deals(status, expiry_date)`. Utilize trigram / case-insensitive indexed queries and bounded limit (max 50). |
| **Out-of-sync local shared package** (`apps/mobile/local-packages/@expyrico/shared`) | High | Build `packages/shared` and sync to mobile local package immediately during Phase 1. |
| **Form State / Edit Id Disconnect** in `NewDealScreen` | High | Fix `NewDealScreen` to check `route.params?.editId`, fetch existing deal via `useDeal(editId)`, and load product & existing fields into `DealForm`. |
| **Spam / Fake Deal Submissions** | High | Enforce mandatory photo proof (`photoUrl`) on deal creation so every deal is backed by a physical receipt or shelf price sticker. |
| **Stale Cache / Vote Race Conditions** | Medium | Invalidate `['deals']` and `['deal', id]` query keys on mutations with optimistic updates via `useOptimisticDealVote`. |

---

## Red Team Review

### Session 1 — 2026-08-26
**Reviewers:** Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic  
**Findings:** 7 (7 accepted, 0 rejected)  
**Severity Breakdown:** 0 Critical, 4 High, 3 Medium  

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Missing Rate Limiting on `GET /v1/deals/stores` (`api/src/routes/deals/stores.ts:18`) | High | Accept | Phase 2 |
| 2 | HTTPS Protocol Enforcement on Deal Photo CDN URLs (`packages/shared/src/schemas/deal.ts:31`) | High | Accept | Phase 1, Phase 2 |
| 3 | Wilson Score Concurrency Lock & Race Condition (`api/src/services/deals/repository.ts:8`) | High | Accept | Phase 2 |
| 4 | Pagination Cursor Tie-Breaker on Equal Price/Expiry Items (`api/src/routes/deals/list-feed.ts:108`) | Medium | Accept | Phase 2 |
| 5 | Timezone Offset Alignment on Expiry Date Filtering (`api/src/routes/deals/list-feed.ts:36`) | High | Accept | Phase 2 |
| 6 | Camera Permission Pre-Flight Before Barcode Scan Navigation (`apps/mobile/app/(app)/deal/new.tsx:114`) | Medium | Accept | Phase 5 |
| 7 | Static Store Presets Fallback During Offline/Network Lag (`apps/mobile/src/features/deals/DealFilterModal.tsx:49`) | Medium | Accept | Phase 4 |

### Whole-Plan Consistency Sweep
- All 7 accepted findings integrated into Phase 1, 2, 4, and 5 specifications.
- Contradictions across plan files: `0`.
- Hardening checks verified and passing.

---

## Validation Log

### Session 1 - Critical Decisions Confirmed
- **Store Suggestions Strategy:** Confirmed Hybrid approach: Curated supermarket chains (Trader Joe's, ALDI, Walmart, Costco, Target, Whole Foods, Kroger) merged with dynamically posted store names from the database.
- **Expiry Date Requirement:** Confirmed Optional expiry date so community members can post both specific clearance date markdowns and general price reductions.
- **Feed Location Scoping:** Confirmed Local First with Global Fallback: Defaults to viewer's country, but falls back seamlessly to global/unscoped deals if local listings are below threshold (<5 deals).
- **Deal Photo Policy:** Confirmed Mandatory Deal Photo: Every new deal requires a receipt or shelf price tag photo to ensure community trust and eliminate spam.

### Session 2 — 2026-08-26 (Operational Policies & Product Rules)
**Trigger:** User validation interview (`/ck:plan validate`)  
**Questions asked:** 4  

#### Questions & Answers

1. **[Assumptions / Moderation]** How should deals flagged for spam or incorrect pricing by multiple community members be handled?
   - Options: Auto-Hide After 3 Reports | Warning Badge Only | Manual Admin Review Only
   - **Answer:** Auto-Hide After 3 Reports (Recommended)
   - **Rationale:** Automatic suppression of heavily flagged deals protects community feed quality before admin moderation.
2. **[Architecture / Scope]** If an item is not found in the community product catalog, how should users post a deal for it?
   - Options: Allow Custom Item Name Directly | Require Product Draft First
   - **Answer:** Allow Custom Item Name Directly (Recommended)
   - **Rationale:** Reduces friction for rapid price drop sharing while keeping items searchable.
3. **[Architecture / Localization]** How should deal currencies be resolved when users post local or imported grocery finds?
   - Options: Profile Default + Form Selector | Strict Home Currency Only
   - **Answer:** Profile Default + Form Selector (Recommended)
   - **Rationale:** Supports regional flexibility and international grocery markets.
4. **[Scope / Roadmap]** Would you like to introduce proactive price drop alerts for items users currently have in their pantry?
   - Options: Pantry Price Watch Notifications | Passive Feed Discovery Only
   - **Answer:** Pantry Price Watch Notifications (Recommended)
   - **Rationale:** High-value retention hook that connects pantry management with community deals.

### Verification Results
- Claims checked: 16
- Verified: 16 | Failed: 0 | Unverified: 0
- Tier: Full (all 4 verification roles)
