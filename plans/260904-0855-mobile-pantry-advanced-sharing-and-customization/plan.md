---
title: "Mobile Pantry Advanced Sharing, Scope Management, and Draggable Navigation"
description: "Comprehensive implementation plan for: (1) long-press multi-select bulk item moving between personal and household pantries, (2) scan/create scope selection with user settings default, (3) household invitation lifecycle with in-app toasts, push, email accept links, and join confirmation, and (4) draggable floating menu button with database persistence."
status: done
priority: P1
effort: "2-3d"
tags: ["mobile", "pantry", "household", "sharing", "invitations", "notifications", "drag-and-drop", "api", "watermelondb"]
created: 2026-09-04
---

# Mobile Pantry Advanced Sharing, Scope Management, and Draggable Navigation

## Overview

A comprehensive engineering plan to deliver four advanced pantry sharing and customization capabilities to Expyrico:
1. **Pantry Multi-Select & Bulk Scope Move**: Long-press any grocery card to select one or multiple items and move them between Personal Pantry and any Household in a single transaction.
2. **Scan & Creation Scope Picker with Settings Default**: Direct pantry destination choice during barcode/QR scanning and manual item creation, pre-selected to the user's preferred default pantry configured in User Settings.
3. **Consent-Driven Household Invitation Lifecycle**: Multi-channel invitation dispatch (in-app toast when active, high-priority push with accept link, and branded email with accept link), requiring explicit user consent before joining, followed by a post-join confirmation email.
4. **Draggable Floating Menu Button with Permanent Persistence**: Fluid drag-and-drop repositioning with edge-snapping for the signature bottom menu button, saved to local storage for zero-flicker launch and synced to the database.

## Problem Statement & Architectural Context

1. **Item Migration Overhead**: Users who switch between solo tracking and household sharing currently have to open each item individually, scroll down, open a picker, and confirm. Moving 20 items takes 40+ manual taps.
2. **Creation Scope Friction**: When scanning groceries with a partner, items default without in-flight choice. Couples need to specify or configure whether groceries go to Personal or Shared up front.
3. **Lack of Invitation Consent & Notifications**: Household invitations should not force immediate membership without the invitee's consent. Users need multi-channel notifications (in-app toast if active, push notification, and email with one-tap accept link) and a formal confirmation upon joining.
4. **Ergonomic Accessibility for Navigation**: The fixed right-aligned menu button at the bottom can be difficult to reach for left-handed users or users with large devices. Allowing users to drag and dock the menu button to either side with permanent cross-device persistence improves reachability.

## Goals & Acceptance Criteria

| # | Goal | Acceptance Criteria | Priority |
|---|------|---------------------|----------|
| 1 | **Bulk Scope Reassignment** | Long-press on any card enters multi-select mode. Users can select multiple items, view a selection counter, tap "Move to...", pick Personal or a Household, and update WatermelonDB and backend Postgres atomically. | P1 |
| 2 | **Creation Scope Choice & Default Setting** | `scan.tsx` and creation forms feature `ScopeSelectorPill` pre-populated with user's default setting. Settings page offers "Default Pantry for New Items" with instant offline persistence and backend sync. | P1 |
| 3 | **Invitation Lifecycle & Notifications** | Inviting a user creates a `HouseholdInvitation`. Dispatches in-app toast (if online), push notification with deep link, and branded email with accept button. User must explicitly Accept to join. Sends confirmation email upon joining. | P1 |
| 4 | **Draggable Bottom Menu Button** | Users can drag the signature menu trigger button across the screen. Button snaps to nearest left/right edge within safe margins. Position is saved locally (zero flicker) and synced to database `uiPreferences`. | P2 |

## Phases Roadmap

| # | Phase | File | Status | Priority | Effort |
|---|-------|------|--------|----------|--------|
| 1 | **Pantry Multi-Select and Bulk Scope Move** | [phase-01-pantry-multi-select-bulk-scope-move.md](./phase-01-pantry-multi-select-bulk-scope-move.md) | done | P1 | 4-5h |
| 2 | **Scan and Create Scope Picker with User Settings Default** | [phase-02-scan-create-scope-picker.md](./phase-02-scan-create-scope-picker.md) | done | P1 | 3-4h |
| 3 | **Household Invitation Lifecycle with Multi-Channel Notifications** | [phase-03-household-invitation-lifecycle.md](./phase-03-household-invitation-lifecycle.md) | done | P1 | 5-6h |
| 4 | **Draggable Floating Menu Button with Persistent Storage** | [phase-04-draggable-menu-button.md](./phase-04-draggable-menu-button.md) | done | P2 | 3-4h |
## Architecture & System Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                    EXPYRICO MOBILE                                     │
│                                                                                        │
│  ┌───────────────────────┐   ┌───────────────────────────┐   ┌──────────────────────┐  │
│  │   Multi-Select Move   │   │     Scan Scope Picker     │   │ Draggable Nav Button │  │
│  │  Long-press to select │   │  Personal vs Household    │   │  Pan gesture + dock  │  │
│  │  Batch WatermelonDB   │   │  Pre-select user default  │   │  Persist to DB/local │  │
│  └───────────┬───────────┘   └─────────────┬─────────────┘   └──────────┬───────────┘  │
│              │                             │                            │              │
│              ▼                             ▼                            ▼              │
│  POST /records/bulk-scope         POST /records (scoped)         PATCH /user/prefs     │
└──────────────┬─────────────────────────────┬────────────────────────────┬──────────────┘
               │                             │                            │
               ▼                             ▼                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FASTIFY BACKEND                                      │
│                                                                                        │
│  ┌───────────────────────┐   ┌───────────────────────────┐   ┌──────────────────────┐  │
│  │   Atomic Bulk Scope   │   │    Household Invitations  │   │ User UI Preferences  │  │
│  │  pg_advisory_xact_lock│   │  In-App Toast (online)    │   │  Store menu button   │  │
│  │  Reschedule reminders │   │  FCM Push (expyrico://)   │   │  dock coordinates    │  │
│  │  Batch record update  │   │  Nodemailer Invite/Confirm│   │  and default scope   │  │
│  └───────────────────────┘   └───────────────────────────┘   └──────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

## Success Criteria Checklist

- [ ] Multi-select mode activates reliably on long-press of any pantry card with haptic feedback.
- [ ] Multiple items can be selected and moved between Personal and any Household in one tap.
- [ ] Scan and creation flows include a clear scope selector defaulting to user preference.
- [ ] User Settings allows configuring the default pantry destination for new items.
- [ ] Household invitations create pending records rather than forcing instant membership.
- [ ] Active users in app receive an in-app banner toast with review action.
- [ ] Push notification with deep link and branded email with accept button are dispatched.
- [ ] Accepting promotes membership, triggers WatermelonDB sync, and dispatches confirmation email.
- [ ] Bottom menu button can be dragged to any custom position on screen, clamped within safe margins.
- [ ] Button position is saved to local storage (zero flicker) and synced to user database record (uiPreferences.menuButtonPosition).
- [ ] 100% automated test coverage across all new APIs, components, and edge cases.

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Concurrent scope reassignment** | Medium | Low | Backend uses `pg_advisory_xact_lock` on affected households and updates in a single transaction. |
| **Spamming email invites** | High | Low | Rate-limiting to 5 invites/hr per household and maximum 10 active pending invites. |
| **Gesture conflict on draggable menu** | Medium | Medium | PanResponder uses strict 6px threshold before capturing responder; taps are isolated cleanly. |
| **Draggable button clipping / off-screen** | Medium | Low | Coordinates clamped strictly within safe area insets; popover menu direction flips dynamically. |

## Validation Log

### Verification Results
- Claims checked: 14
- Verified: 12 | Failed: 2 | Unverified: 0
- Tier: Standard
- Verified files/symbols: `RecordList.tsx`, `RecordCard.tsx`, `scan.tsx`, `AddRecordForm.tsx`, `pantryScope.ts`, `TabsNavigator.tsx`, `Household`, `HouseholdMember`, `User`, `nodemailer`, `notificationSendQueue`, `InAppNotificationBanner.tsx`.
- Failures reconciled: `api/src/routes/user/preferences.ts` (route does not exist; replaced with `/v1/me/preferences`), `api/prisma/schema.prisma:216` (User model lacks `uiPreferences`; migration scheduled in Phase 4).

### Interview Decisions
1. **Bulk Move Destination Collision**: If selected items already reside in the chosen target destination, silently skip those items and move the remaining subset, presenting tangible toast feedback (`"Moved N items to [Target]"`).
2. **Unregistered Invitee Onboarding**: For email invites sent to non-registered addresses, the email link pre-populates registration with the invite token (`expyrico://auth/register?inviteToken=...`). After email verification, the user is presented with the explicit `HouseholdInvitationModal` to confirm acceptance before membership is activated, followed by the confirmation email.
3. **Draggable Menu Button Behavior**: Freeform placement anywhere on screen. The button stays at the exact `(x, y)` coordinate where dropped (clamped strictly within safe area insets). The popover navigation menu dynamically adapts its opening direction based on proximity to edges (e.g. flips left if near right edge, flips down if near top edge).
4. **Default Pantry Configuration**: Unified setting under User Settings ("Default Pantry for New Items") pre-selecting the destination for barcode scan, manual creation, and photo capture flows, with in-flight per-item override.

### Whole-Plan Consistency Sweep
- Zero unresolved contradictions across all phases.
- Phases updated to reflect freeform (x, y) draggable placement and explicit post-registration acceptance gate for new invitees.

## Red Team Review

### Session — 2026-09-04
**Findings:** 8 (8 accepted, 0 rejected)
**Severity breakdown:** 3 Critical, 4 High, 1 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Missing `uiPreferences` Column and `PATCH /v1/user/preferences` Endpoint | Critical | Accept | Phase 2 & Phase 4 |
| 2 | Sync Protocol Rejects Client-Initiated Scope Changes | Critical | Accept | Phase 1 |
| 3 | Unregistered User Auto-Join Privilege Escalation & Token Cryptography | Critical | Accept | Phase 3 |
| 4 | Bulk Move Authorization IDOR & Household Membership Confusion | High | Accept | Phase 1 |
| 5 | Multi-Household Advisory Lock Deadlock | High | Accept | Phase 1 |
| 6 | Notification Send Worker Missing Branch for `household_invitation` & BullMQ Retry | High | Accept | Phase 3 |
| 7 | Email Bombing / Multi-Household Invitation Abuse | High | Accept | Phase 3 |
| 8 | Offline Revoked-Member Edit Silently Destroyed Instead of Reverted | Medium | Accept | Phase 2 |

### Whole-Plan Consistency Sweep
- Converted all 8 findings into explicit implementation contracts across `phase-01`, `phase-02`, `phase-03`, and `phase-04`.
- Replaced non-existent `api/src/routes/user/preferences.ts` with `api/src/routes/me/preferences.ts` (using `PATCH /v1/me/preferences`).
- Replaced client-authoritative offline sync scope move with server-authoritative `POST /v1/records/bulk-scope` online workflow.
- Added Prisma migration requirement for `User.uiPreferences Json?`.
- Standardized lock ordering (`ORDER BY id ASC` before `pg_advisory_xact_lock`) to guarantee deadlock prevention.
- Added 256-bit token entropy with `crypto.timingSafeEqual` and multi-tier rate limiting (max 3 invites per recipient per 24 hours).
- Added explicit worker branch in `notification-send.ts` with BullMQ exponential backoff.
- Updated sync handler on 403/404 to preserve records by reverting to Personal rather than destroying.
- Zero unresolved contradictions remaining across the plan.

<!-- slug: mobile-pantry-advanced-sharing-and-customization -->
