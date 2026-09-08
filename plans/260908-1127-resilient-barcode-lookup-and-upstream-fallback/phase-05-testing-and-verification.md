---
phase: 5
title: "Automated Testing & End-to-End Verification"
status: todo
priority: P1
effort: "4h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Automated Testing & End-to-End Verification

## Overview
Comprehensive verification covering backend unit tests (UPCitemdb 429 handling, OpenFoodFacts timeouts, 12/13-digit normalization, in-store barcode fast-path), mobile scanner unit tests, full TypeScript typechecking, local Android Gradle build, and live physical device verification.

---

## Verification Matrix

| Component / Layer | Verification Command | Target Result |
|---|---|---|
| **Backend Lookup Tests** | `npm --prefix api test -- src/services/products/lookup.test.ts` | All lookup tests pass |
| **Product Draft Lifecycle** | `npm --prefix api test -- tests/integration/products-draft-lifecycle.test.ts` | All draft creation tests pass |
| **Product Lookup Worker Tests** | `npm --prefix api test -- src/workers/product-lookup.test.ts` | All worker retry/hit tests pass |
| **Full API Suite** | `npm --prefix api test` | All test files pass |
| **API Typecheck** | `npm --prefix api run typecheck` | 0 type errors |
| **Mobile Scanner Tests** | `npm --prefix apps/mobile test -- __tests__/scan.test.tsx` | All scanner tests pass |
| **Full Mobile Suite** | `npm --prefix apps/mobile test` | All 143 test suites pass |
| **Mobile Typecheck** | `npm --prefix apps/mobile run typecheck` | 0 type errors |
| **Android Gradle Build** | `cd apps/mobile && JAVA_HOME=... ANDROID_HOME=... gradlew assembleDebug` | BUILD SUCCESSFUL |
| **ADB Device Install** | `adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` | Success |
| **Live Device Verification** | `adb exec-out screencap -p > /tmp/scan_verify.png` | Confirms resilient flow |

---

## Related Code Files
- Test: `api/src/services/products/lookup.test.ts`
- Test: `api/tests/integration/products-draft-lifecycle.test.ts`
- Test: `apps/mobile/__tests__/scan.test.tsx`
- Test: `api/src/workers/product-lookup.test.ts`

---

## Implementation Steps

1. **Run Backend Test Suites**:
   - Verify upstream clients and service classification:
     ```bash
     npm --prefix api test -- src/services/products/lookup.test.ts src/workers/product-lookup.test.ts tests/integration/products-draft-lifecycle.test.ts
     ```
   - Verify full backend test suite and TypeScript:
     ```bash
     npm --prefix api run typecheck
     npm --prefix api test
     ```

2. **Run Mobile Test Suites**:
   - Verify mobile scanner escape hatch:
     ```bash
     npm --prefix apps/mobile test -- __tests__/scan.test.tsx
     ```
   - Verify full mobile regression suite and TypeScript:
     ```bash
     npm --prefix apps/mobile run typecheck
     npm --prefix apps/mobile test
     ```

3. **Local Android Gradle Build & Device Verification**:
   - Clean stale bundle cache:
     ```bash
     rm -rf apps/mobile/android/app/build/generated/assets/createBundleDebugJsAndAssets apps/mobile/android/app/build/intermediates/assets/debug
     ```
   - Build Android debug APK per policy:
     ```bash
     cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
     ```
   - Stream install via ADB:
     ```bash
     adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
     ```
   - Test scanning a restricted in-store barcode (e.g. `251010537516`) and confirm it transitions instantly to "Add New Product" with zero dead-end errors.

---

## Success Criteria
- [ ] 100% test pass rate across backend and mobile test suites.
- [ ] 0 TypeScript errors across the repository.
- [ ] Debug APK builds and installs cleanly via ADB.
- [ ] In-store and uncached barcodes allow immediate pantry addition without ever showing a dead-end error.
