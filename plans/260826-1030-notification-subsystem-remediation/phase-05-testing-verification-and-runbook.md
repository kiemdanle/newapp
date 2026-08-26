---
phase: 5
title: "Testing Verification and Runbook"
status: pending
priority: P1
dependencies: [1, 2, 3, 4]
---

# Phase 5: Testing Verification and Runbook

## Overview
Establishes comprehensive automated test coverage for all notification components, verifies native Android and iOS builds, and documents the operational runbook for configuring Firebase Cloud Messaging (FCM), Apple Push Notification service (APNs), and SMTP email credentials in production.

---

## Requirements

### Functional Requirements
- Comprehensive unit and integration test suite covering:
  - Push token upsert and multi-user device reassignment.
  - Worker dispatch for both record expiry and giveaway notification templates.
  - Offline sync notification schedule job creation.
  - Auth email timeout enforcement and error boundary isolation.
  - Mobile token registration state management and notification tap routing.
- Native build verification on Android and iOS.
- Production deployment runbook detailing environment variables, certificate uploads, and service account configurations.

### Non-Functional Requirements
- All tests must run in isolated test databases/Redis and finish in <30 seconds.
- Zero flaky timers in worker tests: use fake timers / deterministic clocks.

---

## Testing Strategy & Test Suites

### 1. Backend Automated Tests
* **`api/tests/unit/services-push-repository.test.ts`**:
  - Test 1: User A registers token T -> Token owned by User A.
  - Test 2: User B registers same token T -> Token ownership transferred to User B, `revokedAt` reset to `null`.
  - Test 3: Concurrent registration of token T updates safely without 500 error.
  - Test 4: Revoking token by device token marks `revokedAt`.

* **`api/tests/unit/workers-notification-send.test.ts`**:
  - Test 1: Expiry reminder job renders record custom name and calls FCM mock.
  - Test 2: Giveaway job with `giveaway_selected` key queries giveaway entity, renders template, and calls FCM mock.
  - Test 3: Invalid token error (`messaging/registration-token-not-registered`) revokes token in DB.
  - Test 4: Open circuit breaker or provider failure rethrows so BullMQ retries.

* **`api/tests/unit/records-sync-notifications.test.ts`**:
  - Test 1: Syncing new records offline adds corresponding schedule jobs to `notificationScheduleQueue`.
  - Test 2: Syncing existing record with modified expiry date recalculates notifyAt and reschedules jobs.

* **`api/tests/unit/auth-email.test.ts`**:
  - Test 1: `sendVerificationEmail` sends table-based HTML email with 6-digit code.
  - Test 2: Unresponsive SMTP transport triggers connection timeout without blocking thread.
  - Test 3: SMTP failure during registration does not rollback created user account.

### 2. Mobile Automated Tests
* **`apps/mobile/src/features/push/registerPushToken.test.ts`**:
  - Test 1: `ensurePushTokenRegistered` requests permission and registers token when un-cached.
  - Test 2: Account switch (User A -> User B) with same token triggers re-registration.
  - Test 3: Denied notification permission returns cleanly without error.

* **`apps/mobile/src/features/push/handle-notification-open.test.ts`**:
  - Test 1: `moderation_queue` notification verifies origin and opens secure admin URL.
  - Test 2: `expiry` notification navigates to `RecordDetail` with target `recordId`.
  - Test 3: Unknown notification types fail closed without crashing.

---

## Native Build & Compilation Verification

### 1. Android Debug Build Verification
Execute build using local Gradle toolchain:
```bash
cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
```
Verify:
- Exit code is `0`.
- Output APK generated at `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

### 2. iOS Podfile & Framework Verification
```bash
cd apps/mobile/ios && pod install
```
Verify:
- CocoaPods resolves `@react-native-firebase/app` and `@react-native-firebase/messaging` without modular header conflicts.

---

## Production Configuration Runbook

### 1. Firebase Cloud Messaging (FCM) Setup
1. **Google Cloud / Firebase Project:** Ensure project exists (e.g. `expyrico-prod`).
2. **Backend Service Account:**
   - Generate Service Account key JSON in Google Cloud Console with `Firebase Cloud Messaging Admin` role.
   - Set environment variables on API server:
     ```bash
     FIREBASE_PROJECT_ID="expyrico-prod"
     FIREBASE_CREDENTIAL_MODE="service_account_file" # or workload_identity on GCP
     GOOGLE_APPLICATION_CREDENTIALS="/etc/secrets/firebase-service-account.json"
     ```
3. **Android App Registration:**
   - Add Android app in Firebase Console with package name `com.expyrico.app` and SHA-256 certificate fingerprints.
   - Download `google-services.json` and place in `apps/mobile/android/app/google-services.json`.

### 2. Apple Push Notification service (APNs) Setup
1. **Apple Developer Portal:**
   - Create an APNs Authentication Key (.p8 file) under **Certificates, Identifiers & Profiles → Keys**.
   - Note the **Key ID** and **Team ID**.
2. **Firebase Console Configuration:**
   - Navigate to **Project Settings → Cloud Messaging → Apple app configuration**.
   - Upload the `.p8` key file, enter Key ID and Team ID.
   - Add iOS App with Bundle ID `com.expyrico.app`.
   - Download `GoogleService-Info.plist` and place in `apps/mobile/ios/Expyrico/GoogleService-Info.plist`.

### 3. SMTP Email Configuration
Configure production SMTP provider (SendGrid, Postmark, AWS SES, or Mailgun):
```bash
SMTP_HOST="smtp.provider.com"
SMTP_PORT=587
SMTP_USER="apikey"
SMTP_PASS="secret-api-key"
SMTP_FROM="Expyrico <noreply@expyrico.com>"
```

---

## Related Code Files
- Create: `api/tests/unit/records-sync-notifications.test.ts`
- Modify: `api/tests/unit/services-push-repository.test.ts`
- Modify: `api/tests/unit/workers-notification-send.test.ts`
- Modify: `api/tests/unit/auth-email.test.ts`
- Modify: `apps/mobile/src/features/push/registerPushToken.test.ts`
- Modify: `apps/mobile/src/features/push/handle-notification-open.test.ts`

---

## Implementation Steps
1. Implement unit test suites for token repository, workers, sync scheduling, and email resilience.
2. Run full backend test suite (`npm test`).
3. Run mobile unit test suite (`npm test` in `apps/mobile`).
4. Execute Android local Gradle build to confirm clean compilation.
5. Review and document the production deployment runbook.

---

## Success Criteria
- [ ] 100% of notification unit and integration tests pass.
- [ ] Android debug APK builds successfully via Gradle.
- [ ] Production configuration checklist is fully verified.
- [ ] No regression in existing pantry, auth, or moderation test suites.

---

## Risk Assessment
- **Rate limiting / Quotas on FCM and SMTP:** The circuit breakers (`fcmPushBreaker`) and BullMQ concurrency limits (concurrency 4 for send worker) protect against provider rate limits and cascading failure.
