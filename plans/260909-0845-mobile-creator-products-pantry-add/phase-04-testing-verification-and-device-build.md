---
phase: 4
title: "Testing Verification and Device Build"
status: pending
priority: P1
effort: "1h"
dependencies: ["3"]
---

# Phase 4: Testing Verification and Device Build

## Overview
Execute automated test suites across `@expyrico/shared`, `api`, and `apps/mobile`, build the Android debug APK using the local Gradle toolchain, install the APK via ADB onto the connected device, and verify live functionality.

## Requirements
- Functional:
  - Run unit tests in `packages/shared` to confirm schema validation.
  - Run integration tests in `api` to confirm `listDrafts` returns active products for the creator and isolates other users' products.
  - Run Jest component tests in `apps/mobile` to confirm tab filtering, "+ Add" button behavior, and modal interactions.
  - Build Android APK directly with local Gradle/Android toolchain (`JAVA_HOME` + `ANDROID_HOME`).
  - Install via `adb install -r` to connected Xiaomi MI 9 (`96d9c774`).
  - Launch app and verify that both existing products ("test draft" and "Test 2") appear in the "Active" tab and can be added to the pantry.
- Non-functional:
  - No Expo CLI / EAS workflows (per workspace policy).
  - Clean working tree with conventional git commits.

## Architecture
```
[Automated Tests]
       ├── packages/shared: npm test
       ├── api: npm test -- products-draft-lifecycle.test.ts
       └── apps/mobile: npm test -- product-drafts.test.tsx
               │
               ▼
[Local Gradle Build]
       cd apps/mobile && JAVA_HOME=... ANDROID_HOME=... gradlew :app:assembleDebug
               │
               ▼
[ADB Streamed Install]
       adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
               │
               ▼
[Live Device Smoke Test]
       Open "My product drafts" -> see "test draft" & "Test 2" -> Tap "+ Add" -> Add with expiry date
```

## Related Code Files
- Test: `packages/shared/src/schemas/product.test.ts`
- Test: `api/tests/integration/products-draft-lifecycle.test.ts`
- Test: `apps/mobile/__tests__/routes/product-drafts.test.tsx`
- Artifact: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`

## Implementation Steps
1. Run shared package tests:
   `cd packages/shared && npm test`
2. Run api integration tests:
   `cd api && npm test -- tests/integration/products-draft-lifecycle.test.ts`
3. Run mobile Jest tests:
   `cd apps/mobile && npm test -- apps/mobile/__tests__/routes/product-drafts.test.tsx`
4. Assemble debug APK:
   `cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug`
5. Install onto connected Android phone:
   `adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
6. Verify live on device:
   - Launch app: `adb shell am start -n com.expyrico.app/com.expyrico.app.MainActivity`
   - Navigate to Profile -> My product drafts.
   - Verify tabs: All (2 active items shown), Active (2 items shown), In review (0), Drafts (0).
   - Tap "+ Add" on "test draft", select an expiration date, tap Save.
   - Verify item is added to Your Pantry.

## Success Criteria
- [ ] All tests pass across shared, api, and mobile test suites.
- [ ] Debug APK builds without errors in < 60s.
- [ ] ADB install succeeds on device `96d9c774`.
- [ ] Live verification proves existing products appear under "Active" and can be added to the pantry.

## Risk Assessment
- **Risk**: Cache invalidation timing might not update the home pantry immediately.
  - **Mitigation**: Trigger `queryClient.invalidateQueries({ queryKey: ['records'] })` on modal save.
