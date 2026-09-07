---
title: "Used and Discarded Pantry Items Retention with Undo Architecture"
description: "Retain consumed and discarded pantry records with timestamps for future waste-tracking, and provide instant undo plus persistent pantry history."
status: completed
priority: P1
effort: "3-4 days"
tags: ["mobile", "backend", "pantry", "waste-tracking", "undo", "watermelondb", "sync"]
created: 2026-09-06
---

# Used and Discarded Pantry Items Retention with Undo Architecture

## Overview
Currently, marking an item as used (`consumed`) or discarded (`discarded`) immediately hides the item from the active pantry list without an undo affordance. Furthermore, the system lacks `discarded_at` and `discard_reason` tracking, provides no UI view to inspect historical items, and lacks protections against giveaway conflicts, causing user anxiety over mis-taps and preventing future waste-tracking analytics.

This plan delivers:
1. **Schema & Lifecycle Parity**: Persistent storage of `consumed` and `discarded` items across Postgres (Prisma) and WatermelonDB with `consumed_at`, `discarded_at`, structured `discard_reason` (max 50 chars), client-honored timestamps, and indexed status queries.
2. **Giveaway Safety Guard**: Prevention of phantom neighbor giveaways by blocking marking items that are currently listed in open giveaways.
3. **Partial Quantity Support**: For items with quantity $> 1$, allow consuming or discarding a partial amount (e.g. 2 of 6 eggs), decrementing the active record and logging the partial consumption/waste event.
4. **Immediate Undo Toast (6s window)**: Floating undo affordance (latest action) immediately after marking an item, allowing 1-tap instant restoration back to active status with robust race-condition guards and dynamic screen offsets.
5. **Quick Discard Reason Prompt**: A lightweight 1-tap sheet on discard offering common waste reasons (`Expired`, `Spoiled`, `Overbought`, `Leftovers`, `Other`) to capture structured waste telemetry.
6. **Pantry History & Stored Items View**: A dedicated Pantry History screen accessed from the Pantry tab header, displaying used vs discarded items, timestamps, waste reasons, metrics, and individual "Restore to Pantry" actions (with automatic personal fallback if household is revoked).
7. **Notification & Sync Hygiene**: Automatic cancellation of pending notifications when items become inactive, rescheduling on restore, and safe offline-sync reconciliation.

## Architecture & Data Flow

```
+-----------------------------------------------------------------------------+
|                               MOBILE APP                                    |
|                                                                             |
|  [RecordDetail]                                                             |
|       |                                                                     |
|       +--> Check: Active Giveaway linked? ===> Yes: Alert & Block Action    |
|       |                                  ===> No:  Proceed                  |
|       +--> If Quantity > 1: Quick Stepper: "How many? [ 1 of N ]"           |
|       |                                                                     |
|       +--> "Mark as used"       ==> markRecordStatus('consumed', qty)       |
|       |                                                                     |
|       +--> "Mark as discarded"  ==> [Quick Reason Sheet: Expired/Spoiled/..]|
|       |                                     |                               |
|       |                                     v                               |
|       |                             markRecordStatus('discarded', reason)   |
|       v                                                                     |
|  [Pantry List / HomeTab] <=========== Triggers UndoToast (6s window)        |
|       |                                     |                               |
|       |                                     +--> Tap "Undo" (Latest action) |
|       |                                             |                       |
|       |                                             v                       |
|       |                                  restoreLocalRecord('active')       |
|       |                                             |                       |
|       v                                             v                       |
|  [Pantry History Screen] <============= WatermelonDB (records table)        |
|  - All / Used / Discarded                      status: active|consumed|     |
|  - Waste vs Consumed metrics                           discarded (indexed)  |
|  - Reason pills & "Restore to Pantry"          consumedAt / discardedAt    |
|    (with personal fallback if hh revoked)      discardReason                |
+-----------------------------------------------------|-----------------------+
                                                      |
                                           Background Delta Sync
                                           (POST /v1/records/sync)
                                           Client timestamps preserved
                                                      |
                                                      v
+-----------------------------------------------------------------------------+
|                               FASTIFY API & DB                              |
|                                                                             |
|  POST /records/sync & PATCH /records/:id                                    |
|  - Status transitions: active <-> consumed | discarded                      |
|  - Timestamp & reason updates: client-honored consumedAt & discardedAt      |
|  - Reminder management: cancel notification-send jobs on inactive,          |
|    reschedule on restore                                                    |
|  - Prisma Record model indexed by [userId, status, expiryDate]              |
+-----------------------------------------------------------------------------+
```

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Store `consumed` and `discarded` records permanently with exact timestamps (`consumed_at`, `discarded_at`) and constrained `discard_reason` across Postgres and WatermelonDB | P1 |
| 2 | Guard against open giveaway conflicts by blocking mark-as-consumed/discarded when an item is linked to an active giveaway | P1 |
| 3 | Support partial quantity consumption/waste (e.g. 2 of 6 items) by decrementing active records and creating history log entries | P1 |
| 4 | Provide an immediate, animated floating Undo Toast/Snackbar with a 6-second window for the latest marked action with dynamic chrome offset | P1 |
| 5 | Present a quick 1-tap discard reason prompt to collect waste telemetry (`Expired`, `Spoiled`, `Overbought`, `Leftovers`, `Other`) | P1 |
| 6 | Create a dedicated Pantry History screen accessible from the Pantry tab header with Used vs Discarded tabs and 1-tap "Restore to Pantry" (with revoked-household personal fallback) | P1 |
| 7 | Ensure background sync, household sharing, and notification scheduler seamlessly handle status restoration and inactive items | P1 |
| 8 | Establish structured data fields and breakdown metrics for future waste-tracking features (waste rate, value lost, reasons) | P2 |

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | [Database Schema & Synchronization Architecture](./phase-01-database-schema-and-sync-architecture.md) | Complete | 1 day |
| 2 | [Local State & Immediate Undo Mechanism](./phase-02-local-state-and-immediate-undo.md) | Complete | 1 day |
| 3 | [Pantry History & Stored Items View](./phase-03-pantry-history-and-stored-items-view.md) | Complete | 1 day |
| 4 | [Waste-Tracking Foundation & Verification](./phase-04-waste-tracking-foundation-and-verification.md) | Complete | 1 day |

## Success Criteria

- [x] Marking an item as used or discarded never deletes the record; it sets `status` to `'consumed'` or `'discarded'` and records timestamps.
- [x] Attempting to mark an item with an open giveaway blocks the action and prompts the user to cancel the giveaway first.
- [x] Items with quantity $> 1$ provide a quantity selector allowing partial consumption or disposal.
- [x] Marking as discarded opens a quick 1-tap reason prompt before completing the discard.
- [x] An immediate floating Undo Toast appears when navigating back to the Pantry list with a working "Undo" button that restores the item instantly.
- [x] A "Pantry History" entry point exists in the Pantry header that displays stored items filtered by `All`, `Used`, and `Discarded`.
- [x] Users can restore any historically consumed or discarded item back to the active pantry with a single tap, with automatic personal fallback if household membership was revoked.
- [x] Restoring an item reschedules notification reminders, while marking as used/discarded cancels them in BullMQ.
- [x] Full automated test suite passes with unit, component, and sync integration tests.

## Validation Log

### Session 1 - 2026-09-06
- **History UI Access**: Confirmed **Dedicated History screen** (`app/(app)/pantry/history.tsx`) accessible via a header icon in `home.tsx`. Keeps the active pantry clean while providing rich history filtering and restoration.
- **Undo Interaction**: Confirmed **6-second floating toast** (`UndoToast`) positioned above bottom tabs with a prominent "Undo" button and auto-dismiss.
- **Waste Reason Attribution**: Confirmed **Quick reason prompt on discard** — when tapping "Mark as discarded", present a lightweight 1-tap sheet offering categories (`Expired`, `Spoiled`, `Overbought`, `Leftovers`, `Other`) to capture structured waste data.

### Session 2 - 2026-09-06
- **Open Giveaway Guard**: Confirmed **Block mark & prompt to cancel giveaway** — if an item has an active giveaway, block marking it and show an alert: "This item is listed in an active giveaway. Cancel the giveaway first." Prevents orphaned giveaways and false promises to neighbors.
- **Partial Quantity Handling**: Confirmed **Quantity selector for multi-item records** — for records with quantity $> 1$, prompt with a stepper: "Consume/discard how many? [ - 1 + ] of [N]". If partial, decrement active record and create a consumed/discarded entry for accurate waste tracking.
- **Rapid Multi-Item Undo**: Confirmed **Latest action in toast, full history in History screen** — the floating toast reflects the most recent action with a 6-second window; earlier actions can be restored at any time from the dedicated Pantry History screen.
- **Sync & Indexing Fixes**: Client timestamps (`consumedAt`, `discardedAt`) are honored by backend sync for offline accuracy; `status` is indexed in WatermelonDB schema v4; in-flight sync race is guarded so pending undo writes are not clobbered.

### Verification Results
- Claims checked: 10
- Verified: 10 | Failed: 0 | Unverified: 0
- Tier: Standard (Fact Checker + Contract Verifier)

## Red Team Review

### Session — 2026-09-06
**Findings:** 10 (10 accepted, 0 rejected)
**Severity breakdown:** 1 Critical, 6 High, 3 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Open Giveaways orphaned when a linked record is marked consumed/discarded | Critical | Accept | Phase 2 |
| 2 | Partial quantity consumption ignored, skewing waste metrics | High | Accept | Phase 2, Phase 4 |
| 3 | Single-slot UndoToast eviction on rapid multi-item marking | Medium | Accept | Phase 2 |
| 4 | Missing index on status in WatermelonDB schema | High | Accept | Phase 1, Phase 3 |
| 5 | UndoToast hard-coded offset assumes tab bar visibility | Medium | Accept | Phase 2 |
| 6 | PushPending race condition clearing pendingSync mid-undo | High | Accept | Phase 1 |
| 7 | Notification cancellation for inactive records failing in BullMQ | High | Accept | Phase 1 |
| 8 | Server timestamps overwriting client offline consumption times | High | Accept | Phase 1 |
| 9 | Restoring item from a dissolved/revoked household causes sync drop | High | Accept | Phase 2, Phase 3 |
| 10 | Unconstrained discardReason payload in API schema | Medium | Accept | Phase 1 |

### Whole-Plan Consistency Sweep
- Status: Passed with 0 contradictions.
- Verified all 4 phase files incorporate the 10 accepted red-team fixes without terminology drift or orphan references.
