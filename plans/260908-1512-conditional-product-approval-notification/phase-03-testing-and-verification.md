---
phase: 3
title: "Automated Testing & Device Verification"
status: pending
priority: P1
effort: "3h"
dependencies: [1, 2]
---

# Phase 3: Automated Testing & Device Verification

## Overview
Validates backend notification suppression, manual approval notification delivery, mobile post-submission screens, and end-to-end user experience on physical Android device `96d9c774`.

## Requirements
- **Functional**:
  - Add backend integration tests in `api/tests/integration/product-approval-policy.test.ts`:
    - Test Scenario A (`requireApproval: false`, user not flagged): verifies product is auto-approved to `active`, and `prisma.outboxNotification.findMany({ where: { userId: user.id } })` is strictly empty (`toHaveLength(0)`).
    - Test Scenario C (`requireApproval: true`): verifies product is diverted to `pending`, and upon manual approval via `api/src/services/products/product-moderation.ts`, exactly 1 `outboxNotification` with `templateKey: 'product_approved'` is created.
  - Add mobile component tests in `apps/mobile/__tests__/routes/product-new.test.tsx`:
    - Verify submitting an auto-approved product (`status: 'active'`) renders "Published to catalog — you can add it to your pantry now." and passes `lockedPersonalScope: false`.
    - Verify submitting a pending product (`status: 'pending'`) renders "Submitted for review — you can add it to your pantry now." and passes `lockedPersonalScope: true`.
  - Perform live physical verification on Android device:
    - Build debug APK via Gradle toolchain:
      `cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug`
    - Install via ADB:
      `adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
    - Verify product creation when approval is disabled: confirm NO "Product Approved" toast banner appears, and screen displays "Published to catalog".

## Related Code Files
- Modify: `api/tests/integration/product-approval-policy.test.ts`
- Modify: `apps/mobile/__tests__/routes/product-new.test.tsx`

## Implementation Steps
1. **API Integration Suite**:
   - Update `api/tests/integration/product-approval-policy.test.ts`:
     - In `Scenario A: Auto-approves to active when global approval is disabled and user is not flagged`:
       ```typescript
       const outboxCount = await prisma.outboxNotification.count({
         where: { userId: user.id, templateKey: 'product_approved' },
       });
       expect(outboxCount).toBe(0);
       ```
     - Add `Scenario D: Manual admin approval sends product_approved notification when approval was required`:
       - Submit draft under `requireApproval: true` -> status `pending`.
       - Admin approves product -> verify `outboxNotification` with `templateKey: 'product_approved'` is enqueued.
   - Run: `npm --prefix api test -- tests/integration/product-approval-policy.test.ts`
2. **Mobile Test Suite**:
   - Update `apps/mobile/__tests__/routes/product-new.test.tsx`:
     - Add test: `submitting an auto-approved draft displays 'Published to catalog' and unlocks household scope`.
   - Run: `npm --prefix apps/mobile test -- product-new.test.tsx`
3. **Full Suite Execution**:
   - Run all API integration tests: `npm --prefix api run test`
   - Run all mobile unit/component tests: `npm --prefix apps/mobile run test`
   - Run TypeScript typecheck across packages:
     `npm --prefix api run typecheck`
     `npm --prefix apps/mobile run typecheck`
4. **Physical Device Verification**:
   - Build Android debug APK directly with local Gradle (do NOT use Expo).
   - Install via ADB on physical device `96d9c774`.
   - Launch app and test creating a new product when approval is disabled.
   - Capture screencap via `adb exec-out screencap -p > /tmp/after_product_creation.png` and verify using vision inspection that no yellow toast banner appears.

## Success Criteria
- [ ] API integration tests confirm 0 outbox notifications on auto-approval and 1 outbox notification on manual approval.
- [ ] Mobile tests pass for both active and pending product submission scenarios.
- [ ] Physical device confirms no "Product Approved" toast banner when approval requirement is disabled.
- [ ] All test suites green and typecheck 0 diagnostics.

## Risk Assessment
- **Risk**: Device test depends on local network or API availability.
- **Observable Signal**: ADB installation succeeds but app shows network error on submit.
- **Mitigation**: Verify local API server is running on port 3000 and reverse ADB port forwarding (`adb reverse tcp:3000 tcp:3000`) is active.

<!-- Updated: Validation Session 1 - Confirmed flagged user diverted to pending and outbox assertion on manual approval -->
