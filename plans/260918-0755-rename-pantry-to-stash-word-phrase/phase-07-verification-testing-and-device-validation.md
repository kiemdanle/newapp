---
phase: 7
title: "Verification, Testing & Device Validation"
status: pending
priority: P1
effort: "1h"
dependencies: [6]
---

# Phase 7: Verification, Testing & Device Validation

## Overview

Verify the complete platform across all workspaces through automated typechecking, unit tests, Gradle Android APK compilation, and physical device screenshot verification on the connected Xiaomi MI 9 phone.

## Requirements

### Functional Requirements
- Complete automated typechecks across `@expyrico/shared`, `@expyrico/mobile`, `@expyrico/admin`, and `api` with zero errors.
- Pass all unit tests across all packages.
- Compile a clean Android debug APK with the local Gradle/Android toolchain.
- Install the updated APK on the physical Xiaomi MI 9 phone via `adb`.
- Capture live screenshot proof of key surfaces:
  1. **Home Screen**: "Stash" header, "Personal Stash" scope pill, "In Stock" tab, "Stash history" tab.
  2. **Navigation Drawer**: "Stash" menu item and scope indicators.
  3. **Item Detail Screen**: "Stash Location", "Back to stash", and "Add another to stash".
  4. **Scanner Screen**: "STASH SCAN" eyebrow and action buttons.
  5. **Settings Screen**: "Share a stash with your people" and "Default Stash for New Items".
  6. **Storage Location Selector**: Verify that `'Pantry'` is strictly preserved as a storage location preset.
- Push clean commits to `origin/main` and sync production server at `api.linhkienkts.com`.

### Non-Functional Requirements
- Follow project toolchain policies: no Expo CLI, native Gradle builds only.
- Ensure all screenshots are captured at full device resolution.

## Architecture

```
Build & Quality Gate
  ├── Shared: pnpm --filter @expyrico/shared test && build
  ├── Mobile: pnpm --filter @expyrico/mobile typecheck && test
  ├── Admin: pnpm --filter @expyrico/admin typecheck && build
  └── API: pnpm --filter api test
         │
         ▼
Android Native Compilation (Gradle)
  └── assembleDebug ──> adb install ──> Physical Device Verification
```

<!-- Updated: Red Team Review Session - F2 subshell path trap in Gradle/ADB chain -->

## Related Code Files
### Verification Scripts & Commands
- `apps/mobile/android/`
- `scripts/capture_all_screens.py`
- `/tmp/` verification screenshot captures

## Implementation Steps

1. Run workspace typechecks:
   ```bash
   pnpm --filter @expyrico/shared typecheck
   pnpm --filter @expyrico/mobile typecheck
   pnpm --filter @expyrico/admin typecheck
   pnpm --filter api typecheck
   ```
2. Run test suites:
   ```bash
   pnpm --filter @expyrico/shared test
   pnpm --filter @expyrico/mobile test
   pnpm --filter api test
   ```
3. Compile and install Android debug APK (isolated in subshell to prevent directory drift):
   ```bash
   (cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug) && \
   adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
   ```
4. Verify on physical Xiaomi device:
   - Launch app: `adb shell am start -n com.expyrico.app/.MainActivity`
   - Capture Home screen proof: `adb exec-out screencap -p > /tmp/stash_home_proof.png`
   - Open drawer and capture: `adb exec-out screencap -p > /tmp/stash_drawer_proof.png`
   - Open Item Detail and capture: `adb exec-out screencap -p > /tmp/stash_detail_proof.png`
   - Verify Location selector preserves `'Pantry'`.
5. Deploy and sync:
   - Commit changes with conventional message: `feat(copy): rename pantry terminology to stash across platform`.
   - Push to `origin/main`.
   - Pull on `dan@api.linhkienkts.com` and verify systemd service health.

## Success Criteria

- [ ] All package typechecks pass with 0 errors.
- [ ] All unit test suites pass with 0 failures.
- [ ] Android APK builds successfully in Gradle without warnings.
- [ ] Physical Xiaomi phone displays "Stash" consistently across Home, Drawer, Item Details, Scanner, and Settings.
- [ ] Storage location preset `'Pantry'` remains visible and selectable.
- [ ] Production server is synced with `origin/main`.

## Risk Assessment

- **Risk**: Working directory drift when running `cd apps/mobile` causing subsequent adb commands to fail (F2).
- **Mitigation**: Wrap the Gradle compilation step in parentheses `(cd apps/mobile && ...) && adb install -r apps/mobile/...` so the subshell terminates and leaves the outer terminal rooted in the repository root.
- **Risk**: Device UI state requires re-authentication after APK installation.
- **Mitigation**: Sign-in via Google is 1-tap with existing credentials, as verified during push notification tests.
