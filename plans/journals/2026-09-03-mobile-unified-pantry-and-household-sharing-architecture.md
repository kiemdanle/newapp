---
title: Mobile Unified Pantry and Household Sharing Architecture
date: 2026-09-03
summary: "Implemented unified pantry views with All/Personal/Household ScopeToggle, attribution badges, location reassignment, and offline WatermelonDB sync."
---

# Mobile Unified Pantry and Household Sharing Architecture

## What happened
Implemented the full 5-phase Mobile Unified Pantry and Household Sharing architecture on Expyrico mobile:
1. Expanded client store `PantryScope` to `'all' | 'personal' | 'household'` with default `'all'` and unconstrained WatermelonDB query for `'all'`, plus `householdId` support in `patchLocalRecord`.
2. Created a segmented pill `ScopeToggle` control adhering to the Expyrico color palette, dynamically hiding when 0 households exist, with responsive scrolling for >3 segments.
3. Added Mint Mist (`#D6F0E6`) / Deep Sage (`#3A8F6F`) attribution badges on shared `RecordCard`s in `'all'` view, forwarded via `RecordList`.
4. Added `RecordLocationRow` in `RecordDetail` with modal reassign picker, enforcing creator-only reassignment back to personal on both backend and mobile UI with `user_id` WatermelonDB v3 migration.
5. Harmonized `PantryFilterModal` with active scopes and memory isolation, ensured robust sync error recovery on remote household revocation, and measured 500-record query performance under 10ms (<16ms frame budget).

## Decision
- Unified urgency list is the default (`scope: 'all'`) so roommates and families prioritize expiring food collectively.
- Non-creators cannot move shared household items to personal pantry (enforced server-side with 403 and client-side UI suppression).
- Remote household revocation un-wedges sync by purging dead rows on 403/404 during push and reconciling authoritative `householdIds` returned from server sync.

## Next steps
- Monitor mobile sync telemetry on household record operations in production.
- Stack PR for code review and release.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
