---
title: "Notification Subsystem Remediation"
description: "Comprehensive end-to-end fix for Android push, iOS push, token lifecycle, auth emails, and BullMQ worker scheduling"
status: completed
priority: P1
branch: "main"
tags: [push-notifications, email, fcm, apns, bullmq, mobile-native]
blockedBy: []
blocks: []
created: "2026-08-26T01:53:25.943Z"
createdBy: "ck:plan"
source: skill
---

# Notification Subsystem Remediation

## Executive Overview
This implementation plan resolves all 12 defects identified in the notification code review across Android, iOS, the mobile React Native application, backend API services, and BullMQ background workers. 

The remediation restores full production readiness by:
1. Configuring native Google Services on Android, setting up Android 8+ Notification Channels, and enabling background messaging.
2. Configuring iOS `aps-environment` entitlements, `UIBackgroundModes` remote notifications, and native Firebase initialization in `AppDelegate.mm`.
3. Hardening push token lifecycle (multi-account device reassignment, logout revocation, `onTokenRefresh` sync).
4. Implementing mobile foreground banners (`onMessage`) and notification tap routing for expiring record alerts.
5. Hardening SMTP auth emails with socket/connection timeouts and non-blocking error boundaries.
6. Fixing giveaway notification dispatch (`giveawayId` payload mismatch in `processSendJob`), supporting database notification templates, scheduling notifications during offline sync, removing $O(N)$ Redis queue scans, and establishing a recurring outbox sweeper.

---

## Roadmap & Phases

| Phase | Title | Priority | Status | Description |
|---|---|---|---|---|
| **01** | [Native Push Configuration](./phase-01-native-push-configuration.md) | P1 | Completed | Android Gradle plugin, google-services, channels, iOS entitlements, Info.plist, and AppDelegate |
| **02** | [Mobile Lifecycle and Handlers](./phase-02-mobile-lifecycle-and-handlers.md) | P1 | Completed | Token registration, logout cleanup, token rotation, foreground alerts, and notification tap routing |
| **03** | [Push Repo and Email Resilience](./phase-03-push-repo-and-email-resilience.md) | P1 | Completed | Multi-user device token reassignment and SMTP connection/socket timeouts with non-blocking error boundaries |
| **04** | [Worker Outbox and Queue Fixes](./phase-04-worker-outbox-and-queue-fixes.md) | P1 | Completed | Giveaway payload handling in send worker, DB template support, offline sync scheduling, queue scan removal, and recurring outbox sweeper |
| **05** | [Testing Verification and Runbook](./phase-05-testing-verification-and-runbook.md) | P1 | Completed | Automated unit/integration tests, native build verification, and deployment/FCM/APNs configuration runbook |

---

## Architectural Changes & State Transitions

```
[ Mobile App (Android/iOS) ]
       │
       ├─ (1) ensurePushTokenRegistered() ──► POST /me/push-token ──► upsertPushToken()
       │                                                               (reassigns token if user switched)
       ├─ (2) User Logout ───────────────► DELETE /me/push-token/:id ─► revokePushToken()
       │
       ├─ (3) Offline Sync (/records/sync) ──► syncRecords() ────────► notificationScheduleQueue.add()
       │                                                               (schedules delayed BullMQ jobs)
       └─ (4) Push Notification Tap ─────► handleNotificationOpen() ─► Deep links to Record / Moderation
```

---

## Key Files Touched

| Area | Key Files |
|---|---|
| **Android Native** | `apps/mobile/android/build.gradle`, `apps/mobile/android/app/build.gradle`, `apps/mobile/android/app/src/main/AndroidManifest.xml` |
| **iOS Native** | `apps/mobile/ios/Expyrico/Expyrico.entitlements`, `apps/mobile/ios/Expyrico/Info.plist`, `apps/mobile/ios/Expyrico/AppDelegate.mm`, `apps/mobile/ios/Podfile` |
| **Mobile JS** | `apps/mobile/index.js`, `apps/mobile/src/App.tsx`, `apps/mobile/src/features/push/registerPushToken.ts`, `apps/mobile/src/features/push/handle-notification-open.ts`, `apps/mobile/src/api/endpoints.ts` |
| **Backend Push & Auth** | `api/src/services/push/repository.ts`, `api/src/services/auth/email.ts`, `api/src/routes/auth/register.ts`, `api/src/routes/auth/resend-verification.ts` |
| **Workers & Queues** | `api/src/workers/notification-send.ts`, `api/src/workers/notification-schedule.ts`, `api/src/services/records/sync.ts`, `api/src/services/notifications/outbox.ts`, `api/src/workers/runner.ts` |

---

## Verification Strategy
- **Android Proof:** Build debug APK with local Gradle toolchain (`:app:assembleDebug`).
- **iOS Proof:** CocoaPods install & compilation check.
- **Backend Test Suite:** Vitest unit & integration tests covering token upsert, worker execution, email timeouts, and sync scheduling.

---

## Validation Log

### Verification Results
- Claims checked: 18
- Verified: 18 | Failed: 0 | Unverified: 0
- Tier: Full (All 5 phases checked across Android native, iOS native, mobile JS, backend services, and BullMQ queues)

### Interview Decisions
1. **Foreground Push Notification UX:** In-app animated toast/banner with tap-to-navigate action when a notification arrives in foreground.
2. **Offline Sync Scheduling Strategy:** Enqueue individual schedule jobs with deterministic job IDs (`schedule__<recordId>`) to prevent duplicate queue entries.
3. **Multi-User Device Token Reassignment:** Automatically transfer device token ownership to the newly authenticated user and reset `revokedAt` to null upon registration.
4. **SMTP Outage Policy:** Non-blocking user signup; commit user account and session on signup with structured error logging, allowing user to resend verification in-app once SMTP recovers.

### Whole-Plan Consistency Sweep
- **Status:** Passed (0 unresolved contradictions).
- Phase 1 through Phase 5 aligned with all validated decisions and verified file paths.
- Ready for implementation.

---

## Red Team Review

### Session — 2026-08-26
**Findings:** 8 total (8 accepted, 0 rejected)  
**Severity breakdown:** 5 High, 3 Medium

| # | Finding | Lens | Severity | Disposition | Applied To |
|---|---------|------|----------|-------------|------------|
| 1 | Safe string replacement for `{name}` in push templates (`replace(/\{name\}/g, () => name)`) to avoid regex syntax injection | Security Adversary | High | Accept | Phase 4 |
| 2 | BullMQ `addBulk` for batch offline sync scheduling to eliminate Redis latency spikes | Failure Mode Analyst | High | Accept | Phase 4 |
| 3 | Atomic outbox row claim in `outbox.ts` with `updateMany` to prevent duplicate dispatch | Failure Mode Analyst | High | Accept | Phase 4 |
| 4 | `AppState` foreground change listener to re-evaluate notification permission if user enabled it in system settings | Assumption Destroyer | Medium | Accept | Phase 2 |
| 5 | Programmatic Android Notification Channel creation (`expyrico_default`) on app startup in `MainApplication.kt` | Assumption Destroyer | High | Accept | Phase 1 |
| 6 | Cold-boot notification tap buffer until `NavigationContainer`'s `onReady` fires | Failure Mode Analyst | High | Accept | Phase 2 |
| 7 | Lockscreen item name privacy support in `users.notificationPreferences` (`hideItemNames: true`) | Security Adversary | Medium | Accept | Phase 4 |
| 8 | Xcode build configuration mapping for iOS `aps-environment` (dev vs prod) | Assumption Destroyer | Medium | Accept | Phase 1 |

### Whole-Plan Consistency Sweep
- **Status:** Passed (0 unresolved contradictions).
- Decision delta from all 8 accepted findings verified and reconciled across `plan.md`, `phase-01`, `phase-02`, and `phase-04`.
- Red-team hardening complete and ready for implementation.
