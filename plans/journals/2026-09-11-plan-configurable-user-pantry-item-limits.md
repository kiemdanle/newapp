---
title: "Plan: Configurable User Pantry Item Limits & Future Tier Growth Architecture"
date: 2026-09-11
summary: Technical implementation plan for platform-configurable maximum pantry item limits per user manageable via the Admin Dashboard, replacing hardcoded constants with a dynamic resolver service, enforcing active record limits across creation, duplication, and offline sync, providing real-time limit awareness and soft-ceiling data preservation in mobile, and establishing a future-proof architecture for upcoming free and paid user subscription tiers. Hardened across 15 Red Team findings and 16 Advisory Review findings with 0 unresolved contradictions.
---

# Plan: Configurable User Pantry Item Limits & Future Tier Growth Architecture

Technical implementation plan for platform-configurable maximum pantry item limits per user manageable via the Admin Dashboard (`/settings/pantry-limits`), replacing hardcoded constants (`ITEM_LIMIT = 50`) with a dynamic resolver service (`getUserPantryLimit`), enforcing active record limits across record creation, duplication, and offline sync conflict reporting, providing real-time limit awareness and soft-ceiling data preservation in mobile, and establishing a future-proof architecture for upcoming free and paid user subscription tiers without breaking database schemas or API contracts.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Context & Objectives

Currently, the Expyrico platform limits active pantry items via a hardcoded constant (`export const ITEM_LIMIT = 50;` in `@expyrico/shared`), which is checked directly in record creation (`POST /v1/records`), record duplication (`POST /v1/records/duplicate`), and the usage endpoint (`GET /v1/me/usage`). Administrators have no way to modify this limit, and the system lacks a structured bridge for upcoming paid and free user subscription tiers.

Platform administrators require:
1. Dynamic control over the maximum number of pantry items a user can add to their pantry, configurable from the Admin Dashboard (`/settings/pantry-limits`).
2. Centralized dynamic resolution (`getUserPantryLimit(userId)`) supporting the present global platform setting while establishing clear extension points for per-user overrides and future subscription tiers.
3. Enforcement across all record ingestion surfaces: `POST /v1/records`, `POST /v1/records/duplicate`, and `POST /v1/records/sync` (surfacing `item_limit_reached` conflict rather than dropping offline edits).
4. Strict soft-ceiling data preservation: lowering limits blocks new additions on full accounts without deleting, hiding, or locking out existing inventory (view, edit, consume, discard, and delete remain interactive).
5. Mobile UX awareness: `usePantryLimits` React Query hook, capacity indicators, warning banners at capacity, and friendly native alerts on limit rejections.
6. Zero breaking changes guarantee: future payment provider integration (Stripe/Polar) and tier models plug directly into the established resolver without rewriting existing mobile or API code.

## Key Architectural Decisions

1. **Shared Schemas & Tier Entitlement Contracts (`@expyrico/shared`)**:
   - `pantryLimitsSettingsSchema` validates `defaultUserPantryLimit` (range 1–10,000, default 50) and forward-compatible `tierLimits` dictionary (`{ free: 50, pro: 500 }`).
   - Extended `recordSyncConflictSchema.reason` to include `'item_limit_reached'`.
   - Preserves `ERROR_CODES.ITEM_LIMIT_REACHED` and legacy `ITEM_LIMIT` constant for backwards compatibility.
2. **Backend Resolver, Positive Active Transitions & Advisory Locks (`apps/api`)**:
   - `SETTING_KEYS.PANTRY_LIMITS = 'pantry_limits'` with 60-second in-memory TTL caching and invalidation on update.
   - `getUserPantryLimit(userId)` resolves custom override -> tier limit -> global setting -> default fallback (50).
   - **Concurrency Contract**: Per-owner advisory transaction lock (`SELECT pg_advisory_xact_lock(hashtext(userId)::bigint)`) in interactive transactions to eliminate race condition overshoots under PostgreSQL `READ COMMITTED` isolation.
   - **Canonical Lock Ordering**: User Quota Lock acquired first, Household Lock acquired second, mathematically preventing deadlocks.
   - **Positive Active-Count Transition Enforcement**: Quota checked on `POST /records` (+1), `POST /records/duplicate` (+1), `PATCH /records/:id` reactivation (+1 when `isBecomingActive`), and `sync.ts` (+1 on new active or reactivation).
   - **Soft-Ceiling Preservation**: Non-increasing updates (metadata edits, location, status to consumed/discarded) bypass quota checks, allowing full management of existing items even when at or over capacity.
   - Admin routes (`GET`/`PATCH /v1/admin/settings/pantry-limits`) with transactional `AdminAuditLog` recording, and public client route (`GET /v1/settings/pantry-limits`).
3. **Admin Dashboard Interface (`apps/admin`)**:
   - New page `/settings/pantry-limits` under Settings in sidebar (`Layers` icon).
   - Stepper inputs, quick presets (50, 100, 250, 500), soft-ceiling policy explanation, and read-only Future Tier Blueprint card.
4. **Mobile Real-Time Awareness & Resilient Sync (`apps/mobile`)**:
   - `usePantryLimits` hook with AsyncStorage caching (`pantry.limits.v1`) and default fallback.
   - `AddRecordForm` warning banner and button disablement at limit.
   - Record duplication 409 error interception with informative native alerts.
   - Pantry capacity pill with color transitions (`Honey` at 90%, `Alert Red` at 100%).
   - **Resilient Push Loop**: Reordered `pushPending` sequence: (1) Deletes run first to free server capacity, (2) status updates on existing records run second, (3) new creations run third.
   - **Quota Error Isolation**: Catches 409 `item_limit_reached` on `POST /records` without throwing, setting persistent per-item error flag and allowing subsequent items, deletes, and `pullSince` to execute unhindered.
   - **Automatic Retry**: Deleting or consuming an item on subsequent sync frees quota first and allows pending creations to succeed.
5. **Future Tier Extensibility (`api`, `docs`)**:
   - Documented subscription bridge in `docs/architecture/pantry-limits-and-future-tiers.md`.
   - Simulation integration tests in `api/tests/integration/tier-limits-simulation.test.ts`.

## Advisory Review Hardening

Following Red Team adjudication, an adversarial advisory review was conducted across the plan and codebase, surfacing 16 concrete findings (13 P1 blockers, 3 P2 improvements). All 16 findings were accepted and applied across the phase files:
1. **HTTP Sync Route Metadata Propagation**: Exposed `nextCursor` and `hasMore` from `SyncOutcome` directly in `api/src/routes/records/sync.ts` HTTP response.
2. **Isolated Sync Upsert Transactions**: Wrapped each sync upsert in a short transaction, locking user quota, re-reading fresh row status, and catching `ITEM_LIMIT_REACHED` to append to `conflicts` without failing the batch.
3. **Giveaway Cancel Lock Order & Locked Classification**: Projected `user_id AS "userId"`; locked giveaway row `FOR UPDATE` first (serializing double-cancels), acquired owner quota unconditionally, then locked record `FOR UPDATE` and classified transition under the lock (asserts quota on consumed reactivation; increments quantity on active records); added double-cancel and deadlock integration tests.
4. **Locked Client-Id Replay Resolution**: Re-checked `findUnique({ where: { clientId } })` inside transaction under `lockUserPantryQuota` before asserting quota, preventing race condition quota rejections on committed retries.
5. **Terminal History Status Persistence**: Normalized `effectiveStatus = input.status ?? 'active'`; serialized terminal timestamps and reason in `POST /records` so offline split history remains terminal without consuming quota.
6. **Transaction-Aware Permission Helpers**: Added optional `tx` to `assertMember`; centralized `lockHouseholdRow` in `permissions.ts`; sorted multi-household locks in PATCH moves.
7. **Preserving Pending Quota Restores on Pull**: Protected pending quota-rejected local writes from being overwritten by older server state in `pullSince`.
8. **Model Lifetime & In-Flight Invalidation Protection**: Re-fetched models inside `database.write` in mobile sync, acknowledging only sent fields to preserve newer local edits.
9. **Duplicate Ownership Stamping**: Stamped `userId: currentUserId` on duplicate drafts in `RecordList.tsx`, never copying the source record's owner.
10. **Remote Deletion Convergence**: Aligned `usePantryLimits` with authoritative `/v1/me/usage` alongside local active counts.
11. **Atomic Settings Read/Merge/Write & Audit**: Implemented `updatePantryLimits` in `settings.ts` wrapping read-merge-write and `writeAuditLog` in a single transaction.
12. **Prisma Composite Seek Query & Uncapped In-Memory Drainage**: Structured Prisma query with `AND: [seekCondition, visibilityCondition]` preventing silent `OR` key overwrites; eliminated arbitrary 20-page cap using an uncapped non-persistent in-memory drainage loop, preventing cross-account cursor leakage and infinite restart loops.
13. **Immutable Offline Create Payloads**: Maintained create payload immutable until remote serverId confirmed, queuing newer edits as separate PATCH operations.
14. **Process-Local Cache Policy**: Documented 60s TTL bounded propagation; ensured admin operations are always direct and authoritative.
15. **Household Lock Derivation Standardization**: Standardized 60-bit integer key derivation for household advisory locks.
16. **Complete UI Feedback**: Added 90% warning banner in AddRecordForm, subtle Honey/Alert Red capacity pill in `home.tsx`, sync error chip in `RecordCard.tsx`, and admin decrease confirmation modal.
## Implementation Plan Overview

- Plan: `plans/260911-1501-configurable-user-pantry-item-limits/plan.md`
- Phases:
  - `phase-01-shared-schemas-and-tier-contracts.md`: Shared Schemas & Tier Contracts
  - `phase-02-api-backend-and-resolver.md`: API Backend Settings, Dynamic Resolver & Limit Enforcement
  - `phase-03-admin-settings-ui.md`: Admin Dashboard Settings UI & User Inspection Hooks
  - `phase-04-mobile-pantry-limit-awareness.md`: Mobile App Limit Awareness, Soft-Ceiling & Feedback UI
  - `phase-05-future-tier-extensibility-and-verification.md`: Future Tier Extensibility & End-to-End Verification
