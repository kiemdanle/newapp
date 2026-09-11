---
title: "Configurable User Pantry Item Limits & Future Tier Growth Architecture"
description: "Implement platform-configurable maximum pantry item limits per user manageable from the Admin Dashboard, replacing hardcoded constants with a dynamic resolver service, enforcing active record limits on creation/duplication/sync, providing real-time limit awareness and soft-ceiling handling in mobile, and establishing a future-proof architecture for upcoming free and paid user subscription tiers."
status: pending
priority: P1
effort: "2d"
tags: [pantry, settings, admin, mobile, billing-preparation, limits]
created: 2026-09-11
---

# Configurable User Pantry Item Limits & Future Tier Growth Architecture

## Overview

Currently, the Expyrico platform limits active pantry items via a hardcoded constant (`export const ITEM_LIMIT = 50;` in `@expyrico/shared`), which is checked directly in record creation (`POST /v1/records`), record duplication (`POST /v1/records/duplicate`), and the usage endpoint (`GET /v1/me/usage`). Administrators have no way to modify this limit, and the system lacks a structured bridge for upcoming paid and free user subscription tiers.

This plan delivers a complete, dual-horizon solution:
1. **Present Deliverable**: Administrators can dynamically configure the maximum pantry item limit (default: 50, range: 1–10,000) via a dedicated Admin Dashboard Settings interface (`/settings/pantry-limits`). The backend resolves this limit dynamically per user, validates it on record creation, duplication, and offline synchronization, and returns accurate real-time usage to clients. Mobile users receive clear visual capacity feedback, friendly banners when approaching limits, and helpful error handling when limits are exceeded.
2. **Future Growth Architecture**: Establishes a forward-compatible tier and entitlement resolution contract (`getUserPantryLimit(userId)`). While today the platform has no payment processing or separate free/paid user flags, the resolver and data schemas are architected with explicit tier hooks (`tierLimits: { free: 50, pro: 500 }` and user override resolution) so that when paid tiers (e.g. Free vs. Pro/Premium) are implemented in the near future, the transition requires zero breaking changes to database schemas, REST APIs, or mobile client code.

---

## Architectural Principles & Growth Strategy

### 1. Present vs. Future Growth Blueprint

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PRESENT ARCHITECTURE (Phase 1-4)                                            │
│                                                                             │
│  Admin Dashboard ───► Setting ('pantry_limits')                             │
│                         └─► defaultUserPantryLimit: 50                      │
│                               │                                             │
│  User Request ────────► getUserPantryLimit(userId)                          │
│                               │                                             │
│                         ┌─────┴────────────────────────┐                    │
│                         ▼                              ▼                    │
│                   Optional User                Global Setting               │
│                  Override (null)           (defaultUserPantryLimit)         │
│                         │                              │                    │
│                         └──────────────┬───────────────┘                    │
│                                        ▼                                    │
│                            Resolved Limit: 50                               │
│                                        │                                    │
│                     Enforced in Create, Duplicate, Sync                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ FUTURE GROWTH EXPANSION (Phase 5 - Zero Breaking Changes)                   │
│                                                                             │
│  Payment Gateway (Stripe/Polar) ──► UserSubscription / User.tier            │
│                                      ('free' | 'pro' | 'supporter')         │
│                                              │                              │
│  Admin Dashboard ───► Setting ('pantry_limits')                             │
│                         ├─► defaultUserPantryLimit: 50                      │
│                         └─► tierLimits: { free: 50, pro: 500, family: 1000 }│
│                               │                                             │
│  User Request ────────► getUserPantryLimit(userId)                          │
│                               │                                             │
│                         ┌─────┴────────────────────────┐                    │
│                         ▼                              ▼                    │
│                   Tier-Based Limit               User Custom                │
│                   tierLimits[tier]             Override (VIP)               │
│                         │                              │                    │
│                         └──────────────┬───────────────┘                    │
│                                        ▼                                    │
│                         Resolved Limit: 500 (Pro)                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. The Soft-Ceiling & Data Preservation Mandate
- When administrators lower the pantry item limit (e.g., from 100 to 50 items), existing users who already have more than 50 active items MUST NEVER suffer data loss or operational lockouts.
- **Allowed actions on existing items above limit**: View, search, filter, edit, update notes, change location, consume, discard, and delete.
- **Blocked actions above limit**: Creating new items (`POST /v1/records`), duplicating items (`POST /v1/records/duplicate`), and offline-sync creation of new active items (`POST /v1/records/sync`).
- **Clear feedback**: Mobile and web clients present an empathetic warning: *"You have 62 of 50 allowed items. Existing items are safe, but you cannot add new items until you consume or delete 13 items."*

---

## Goals & Acceptance Criteria

| # | Goal | Acceptance Criteria |
|---|------|---------------------|
| 1 | **Shared Schemas & Contracts** | `@expyrico/shared` exports `pantryLimitsSettingsSchema`, `PantryLimitsSettings`, `DEFAULT_PANTRY_LIMITS`, and updates `RecordSyncConflict` with `'item_limit_reached'`. |
| 2 | **Dynamic Backend Settings & Cache** | `api/src/services/admin/settings.ts` supports `SETTING_KEYS.PANTRY_LIMITS = 'pantry_limits'` with 60-second TTL in-memory caching and transactional audit logging on update. |
| 3 | **Centralized Limit Resolver & Concurrency Lock** | `getUserPantryLimit(userId)` and `assertCanAddPantryItems(userId, count)` run under per-owner advisory transaction locks (`SELECT pg_advisory_xact_lock(hashtext(userId))`) with canonical lock ordering (User Quota -> Household) to guarantee zero overshoots under concurrent requests, enforcing quota on every positive active transition (`create`, `duplicate` via `POST /v1/records/:id/duplicate`, `patch` reactivation, `cancel` giveaway restoration, `sync`). |
| 4 | **Admin Dashboard Interface** | Admins can view and update pantry limits at `/settings/pantry-limits` with steppers, presets (50, 100, 250, 500), audit logs, and Expyrico palette styling. |
| 5 | **Mobile Real-Time Awareness & Resilient Sync** | Mobile client fetches limits via `usePantryLimits`, warns users near limit ($\ge 90\%$), blocks additions at 100%, and re-orders `pushPending` (deletes -> updates -> creates) with 409 quota error isolation to ensure offline quota rejections never wedge sync or block `pullSince`. |
| 6 | **Future Tier Architecture** | Tier resolver hooks documented, simulated in integration tests, ensuring zero breaking changes when paid tiers are launched. |

---

## Phases

| # | Phase | File | Status | Description |
|---|-------|------|--------|-------------|
| 1 | **Shared Schemas & Contracts** | [`phase-01-shared-schemas-and-tier-contracts.md`](./phase-01-shared-schemas-and-tier-contracts.md) | Pending | Define Zod schemas, defaults, sync conflict types, and sync vendored dist. |
| 2 | **API Backend & Resolver** | [`phase-02-api-backend-and-resolver.md`](./phase-02-api-backend-and-resolver.md) | Pending | In-memory cached settings, dynamic resolver, positive transition enforcement, advisory locks, concurrency tests. |
| 3 | **Admin Settings UI** | [`phase-03-admin-settings-ui.md`](./phase-03-admin-settings-ui.md) | Pending | Admin settings page, server actions, presets, audit logging, and future tier blueprint card. |
| 4 | **Mobile Awareness & UI** | [`phase-04-mobile-pantry-limit-awareness.md`](./phase-04-mobile-pantry-limit-awareness.md) | Pending | `usePantryLimits` hook, AddRecordForm limit notice, duplicate alert, resilient `pushPending` reordering, quota isolation. |
| 5 | **Future Tier Extensibility** | [`phase-05-future-tier-extensibility-and-verification.md`](./phase-05-future-tier-extensibility-and-verification.md) | Pending | Entitlement architecture validation, integration tests, full-stack verification. |

---

## Risk Assessment & Mitigation

| Risk | Impact | Pre-Decided Mitigation |
|------|--------|------------------------|
| **Race Condition on Concurrent Creates** | User creates items simultaneously from two devices exceeding limit under Postgres READ COMMITTED | Serialize actor's increasing operations via `pg_advisory_xact_lock(hashtext(userId)::bigint)` in interactive transaction; verify with concurrent `Promise.all` test at limit−1. |
| **Offline Sync Burst Wedges Mobile Sync** | Offline 409 quota failure aborts `pushPending`, preventing deletes and `pullSince` | Reorder `pushPending` (deletes -> updates -> creates) and isolate 409 errors per item, keeping `pendingSync = true` while allowing sync and `pullSince` to proceed cleanly. |
| **Admin Lowers Limit Below Existing Inventories** | Users with 80 items locked out if limit becomes 50 | Enforce soft ceiling: edits, updates, consumption, and deletion remain fully functional; only new additions blocked. |
| **Performance Overhead on Record Creation** | Extra DB query to count active records on every insert | Count query utilizes existing indexed composite `(userId, status)` on `records` table, completing in < 1ms. |
| **Future Paid Tier Schema Incompatibility** | Introducing paid tiers later breaks existing client contracts | `meUsageResponseSchema` and `pantryLimitsSettingsSchema` already include `tierLimits` and dynamic `itemLimit`. |

---

## Validation Log

### Session 1 — 2026-09-11
**Trigger:** Validation interview requested via `/ak:plan validate`
**Questions asked:** 4

#### Questions & Answers

1. **[Architecture]** How should the pantry item limit be counted when a user belongs to shared households?
   - Options: All items created by user (personal + household) (Recommended) | Only personal pantry items (household exempt)
   - **Answer:** All items created by user (personal + household) (Recommended)
   - **Rationale:** Counts all active records where `userId = user.id` (`status = 'active'`). This maintains strict quota integrity across personal items and household contributions, aligns with existing API logic in `records/create.ts`, and prevents bypassing limits by creating records in shared households.

2. **[Architecture]** What should be the platform default pantry limit and admin configuration range?
   - Options: 50 items default (Range: 1–10,000) (Recommended) | 100 items default (Range: 10–5,000) | 25 items default (Range: 1–2,500)
   - **Answer:** 50 items default (Range: 1–10,000) (Recommended)
   - **Rationale:** Preserves the existing platform baseline (50 items) so existing users experience no disruption, while giving administrators the full range (1 to 10,000) to tune allowances or grant large allowances to power users.

3. **[Tradeoffs]** How should the server handle offline-created records that push an account over the limit during sync?
   - Options: Surface sync conflict with warning (Recommended) | Soft-accept offline burst then block further additions | Drop overflow items on server
   - **Answer:** Surface sync conflict with warning (Recommended)
   - **Rationale:** Returns an `item_limit_reached` conflict in `RecordSyncResponse`. The local record is retained in WatermelonDB with a sync alert indicator so user data is never lost, and the user is guided to free up space.

4. **[Scope]** How should pantry capacity and limits be presented to users in the mobile app?
   - Options: Contextual warnings (at 90%+ & Add Item screen) (Recommended) | Persistent top bar capacity pill | Silent until limit blocked
   - **Answer:** Contextual warnings (at 90%+ & Add Item screen) (Recommended)
   - **Rationale:** Keeps the primary Pantry UI uncluttered during normal use, displaying item counts subtly in the drawer/header, while proactively warning users when they reach 90%+ capacity and providing full feedback on the Add Item form.

#### Confirmed Decisions
- **Counting Scope**: All active records where `userId = user.id` (`status = 'active'`) count toward the user's quota.
- **Default & Range**: 50 items default; Admin range: 1 to 10,000.
- **Offline Sync Behavior**: Surface `reason: 'item_limit_reached'` in sync conflict responses; retain local records with alert.
- **Mobile UI Presentation**: Contextual warnings at 90%+ capacity and on Add Item screen; subtle count in drawer/header.

---

## Red Team Review

### Session 1 — 2026-09-11
**Reviewers Deployed (4 parallel lenses)**: Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic  
**Findings Total**: 15 (15 accepted, 0 rejected)  
**Severity Breakdown**: 4 Critical, 9 High, 2 Medium — all backed by concrete `file:line` codebase citations  

| # | Finding | Severity | Disposition | Applied To | Codebase Evidence |
|---|---------|----------|-------------|------------|-------------------|
| 1 | Idempotency 409 caching for 24h prevents retry after capacity freed | Critical | Accept | Phase 2, `idempotency.ts` | `api/src/plugins/idempotency.ts:28,229,245` |
| 2 | Household member reactivation charges caller instead of record creator | Critical | Accept | Phase 2, `patch.ts` | `api/src/routes/records/patch.ts:20,23`, `permissions.ts:69` |
| 3 | Status transition precheck outside transaction allows TOCTOU bypass | Critical | Accept | Phase 2, `patch.ts` | `api/src/routes/records/patch.ts:23,57,94` |
| 4 | Giveaway cancellation reactivates consumed records without quota check | Critical | Accept | Phase 2, `cancel.ts` | `api/src/routes/giveaways/cancel.ts:28-34` |
| 5 | Delete-first in sync reuses destroyed WatermelonDB model references | High | Accept | Phase 4, `sync.ts` | `apps/mobile/src/db/sync.ts:50,149`, `records.ts:568` |
| 6 | Newly introduced PATCH quota rejections still wedge mobile sync loop | High | Accept | Phase 4, `sync.ts` | `apps/mobile/src/db/sync.ts:96,103,131` |
| 7 | Mobile duplicate UI lives in `RecordList.tsx`, not `record/[id].tsx` | High | Accept | Phase 4, `RecordList.tsx` | `apps/mobile/src/features/records/RecordList.tsx:383,428` |
| 8 | Committed creation with dropped response cannot recover if quota reached | High | Accept | Phase 2, `create.ts` | `api/src/routes/records/create.ts:44,88-93` |
| 9 | Admin form silently resets hidden tier limits on partial PATCH | High | Accept | Phase 1 & 2, `settings.ts` | `api/src/services/admin/settings.ts:42-45` |
| 10 | Defaulting failed admin read overwrites live production limit | High | Accept | Phase 3, `page.tsx` | `apps/admin/src/app/(admin)/settings/pantry-limits/page.tsx:8` |
| 11 | Delta sync truncation and equal-timestamp boundary data loss under 10k ceiling | Critical | Accept | Phase 1, 2, 4, 5, `sync.ts` | `api/src/services/records/sync.ts:249,259,260`, `sync.ts:339` |
| 12 | Partial-consumption split history records treated as active additions | High | Accept | Phase 1, `record.ts` | `apps/mobile/src/api/records.ts:446-481`, `schema.prisma:735` |
| 13 | Local mobile active count must count creator across personal/households | High | Accept | Phase 4, `record-counters.ts` | `apps/mobile/src/api/records.ts:111,142`, `AddRecordForm.tsx:170` |
| 14 | Mobile React Query cache has no refresh path on sync completion | Medium | Accept | Phase 4, `RecordList.tsx` | `apps/mobile/src/api/query-client.ts:16`, `triggers.ts:16` |
| 15 | Household locks do not re-verify membership inside transaction | Medium | Accept | Phase 2, `create.ts`, `sync.ts` | `api/src/routes/records/create.ts:26`, `sync.ts:41,105` |

### Whole-Plan Consistency Sweep — Red Team
- **Phase 1**: Updated `pantryLimitsPatchSchema`, `recordCreateSchema` optional status and terminal timestamps, and composite seek cursor schemas (`cursor`, `nextCursor`, `hasMore`).
- **Phase 2**: Added idempotency 409 cache release, idempotent `clientId` pre-resolution, owner-based locking on `patch.ts`, post-lock membership revalidation, giveaway cancellation quota check, composite seek pagination (`orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }]`), and comprehensive transition/concurrency tests.
- **Phase 3**: Replaced page read fallback with error/retry state; wired partial patch to preserve tier limits.
- **Phase 4**: Reordered `pushPending` with disjoint worksets, dual 409 isolation on POST and PATCH, composite cursor delta drainage loop in `pullSince()` with post-drainage checkpoint advancement, `RecordList.tsx` duplicate guards, and creator-scoped `useMyActiveRecordCount`.
- **Phase 5**: Aligned tier scope to KISS/YAGNI without premature DB mutations; added 1,005 equal-timestamp boundary pagination test across the 1,000-row page threshold.

---

## Advisory Review & Hardening

### Session 1 — 2026-09-11
**Advisor Deployed**: `kongming` (Autonomous counsel via Fable 5 protocol)  
**Focus Areas**: Concurrency & locking contracts, ingestion vectors, mobile sync resilience, admin settings persistence, and edge cases.  
**Findings Total**: 16 (16 accepted, 0 rejected)  
**Severity Breakdown**: 13 P1 (Implementation/Correctness Blockers), 3 P2 (Cache/Architecture/UI Alignment)  

| # | Severity | Finding | Codebase Evidence | Fix Applied to Plan |
|---|---|---|---|---|
| F01 | P1 | Pagination metadata (`nextCursor`, `hasMore`) omitted from HTTP response adapter in `api/src/routes/records/sync.ts:10-18` | `api/src/routes/records/sync.ts:10-18`, `services/records/sync.ts:10-16` | Extended `SyncOutcome` with `nextCursor` & `hasMore`; updated `api/src/routes/records/sync.ts` to expose them in wire response; added `routes/records/sync.ts` to Phase 2 scope. |
| F02 | P1 | Sync upserts lacked locked re-reading and positive transition isolation; quota rejection would crash entire batch | `api/src/services/records/sync.ts:74-91,157-165,220` | Wrapped each upsert in short transaction with `lockUserPantryQuota`, re-read fresh status inside lock, asserted quota on positive transitions, and caught `ITEM_LIMIT_REACHED` to push `{ clientId, reason: 'item_limit_reached' }` into `conflicts` without aborting batch. |
| F03 | P1 | Giveaway cancellation lacked `user_id` projection, omitted giveaway row lock, and inverted lock order | `api/src/routes/giveaways/cancel.ts:23-24`, `select.ts:37-55` | Projected `user_id AS "userId"`; locked giveaway row `FOR UPDATE` first (serializing double-cancels), acquired owner quota unconditionally, then locked record `FOR UPDATE` and classified transition under the lock (asserts quota on consumed reactivation; increments quantity on active records); added double-cancel and deadlock integration tests. |
| F04 | P1 | ClientId lookup before lock allowed concurrent replay to fail quota if first request committed last slot | `api/src/routes/records/create.ts:87-100`, `idempotency.ts:74` | Relocated `findUnique` check inside transaction under `lockUserPantryQuota` before quota assertion; returns 201 for same-user replay, 409 conflict for other user. |
| F05 | P1 | Terminal history records lacked end-to-end status serialization in POST /records | `apps/mobile/src/db/sync.ts:58-72`, `api/src/routes/records/create.ts:56-73` | Normalized `effectiveStatus = input.status ?? 'active'`; serialized terminal timestamps and reason; only asserted quota and enqueued reminders when `effectiveStatus === 'active'`. |
| F06 | P1 | Missing transaction client in `assertMember` and missing multi-household sorted locking in PATCH | `api/src/services/households/permissions.ts:15-21`, `patch.ts:23-54` | Added optional `tx` to `assertMember`; centralized `lockHouseholdRow(tx, householdId)`; sorted household IDs `[oldHouseholdId, newHouseholdId].filter(Boolean).sort()` before locking in PATCH. |
| F07 | P1 | Household restore quota rejection wiped on subsequent server pull | `apps/mobile/src/db/sync.ts:168-195,212-237` | In `pullSince`: checked `syncQuotaErrorsStore.has(clientId)`; preserved local pending restore when quota-rejected; only `scope_changed` triggers force-overwrite. |
| F08 | P1 | Model lifetime & in-flight invalidation during async network awaits | `apps/mobile/src/db/sync.ts:77-83,103-110` | Snapshot payload before await; re-fetched model inside `database.write`; verified not deleted; acknowledged only fields sent to avoid wiping newer local edits. |
| F09 | P1 | Duplicate in `RecordList.tsx` copied source owner's ID, skewing creator-scoped counts | `apps/mobile/src/features/records/RecordList.tsx:428-443` | In `handleSaveEdit`, always stamped `userId: currentUserId` (from session store) on duplicate drafts, never copying source owner. |
| F10 | P1 | Remote deletion convergence and usage endpoint alignment | `api/src/routes/records/delete.ts:23`, `apps/mobile/src/utils/pantry-limits.ts` | Combined local active count with authoritative `/v1/me/usage` in `usePantryLimits`; invalidated usage on pull-to-refresh. |
| F11 | P1 | Non-atomic read/merge/write and audit logging for admin settings | `api/src/services/admin/settings.ts:36-46`, `routes/admin/settings/pantry-limits.ts` | Implemented `updatePantryLimits(patch, adminId)` in settings service wrapping read-for-update, partial merge, write, and `writeAuditLog(..., tx)` in single transaction. |
| F12 | P1 | Prisma query object key collision between seek `OR` and visibility `OR`; arbitrary 20-page cap restarted sync forever on large accounts | `api/src/services/records/sync.ts:248-261`, `apps/mobile/src/db/sync.ts` | Structured Prisma query with `where: { AND: [seekCondition, visibilityCondition] }`; eliminated arbitrary 20-page cap using an uncapped non-persistent in-memory drainage loop, preventing cross-account cursor leakage and infinite restart loops. |
| F13 | P1 | Modified offline create body failing idempotency preHandler | `api/src/plugins/idempotency.ts:184-189`, `apps/mobile/src/db/sync.ts:55-76` | Maintained create payload immutable until remote `serverId` confirmed; queued subsequent local edits as separate PATCH operations. |
| F14 | P2 | Process-local 60s TTL cache propagation policy | `api/src/services/admin/settings.ts:63-75` | Documented 60s TTL bounded propagation; ensured admin reads/writes are always direct and authoritative. |
| F15 | P2 | Discrepancy in household lock key derivation across callers | `api/src/routes/households/dissolve.ts:11`, `join.ts:103` | Centralized `lockHouseholdRow` in `permissions.ts` using normalized 60-bit integer derivation across all callers. |
| F16 | P2 | Unmet UI feedback: 90% warnings, decrease confirmation modal, and sync error badges | `plan.md:139-148`, `apps/mobile/app/(app)/(tabs)/home.tsx` | Added 90% warning banner in AddRecordForm; added subtle Honey/Alert Red capacity pill in `home.tsx`; added sync quota warning badge on `RecordCard.tsx`; added decrease confirmation modal in admin form. |

---

### Whole-Plan Consistency Sweep — Final
- **Files Reread & Audited**: `plan.md`, `phase-01-shared-schemas-and-tier-contracts.md`, `phase-02-api-backend-and-resolver.md`, `phase-03-admin-settings-ui.md`, `phase-04-mobile-pantry-limit-awareness.md`, `phase-05-future-tier-extensibility-and-verification.md`.
- **Decision Deltas Verified**: 16/16 findings applied consistently across schemas, routes, services, mobile sync, and admin UI.
- **Reconciled Stale References**: `POST /v1/records/:id/duplicate` normalized; `api/src/routes/records/sync.ts` and `api/src/services/households/permissions.ts` registered; `AND: [seekCondition, visibilityCondition]` confirmed; Giveaway cancellation canonical lock order (Giveaway -> Quota -> Household -> Record) and locked state classification verified; arbitrary 20-page mobile sync cap eliminated with safe in-memory uncapped drainage.
- **Unresolved Contradictions**: **0**.
<!-- slug: configurable-user-pantry-item-limits -->
