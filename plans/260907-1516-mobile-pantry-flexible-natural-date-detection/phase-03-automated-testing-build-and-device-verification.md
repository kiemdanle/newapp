---
phase: 3
title: "Automated Testing Build and Device Verification"
status: pending
priority: P1
effort: "3h"
dependencies: [1, 2]
---

# Phase 3: Automated Testing Build and Device Verification

## Overview
Implement an exhaustive test suite for natural date detection (covering all permutations of 2-digit years, day/month formats, English/Vietnamese textual months, compact digits, relative shorthand, and leap years), compile the Android debug APK with local Gradle, and verify live on Xiaomi MI 9.

## Requirements
- Functional:
  - Comprehensive unit test suite in `apps/mobile/src/utils/__tests__/naturalDateParser.test.ts`:
    - 2-digit years: `13/9/26`, `13-9-26`, `13.9.26`, `26/9/13`
    - Day & month only: `13/9`, `13-9`, `9/13`
    - English months: `Sep 13`, `13 Sep`, `September 13`, `13 September`, `13-Sep-2026`
    - Vietnamese months: `13 thg 9`, `13 thang 9`, `13 Th09`, `Thg 9 13`
    - Compact digits: `130926`, `13092026`, `20260913`, `1309`
    - Relative offsets: `+3`, `3d`, `1w`, `2w`, `1m`, `3m`, `tomorrow`
    - Leap years: `29/02/2024` (valid), `29/02/2025` (invalid)
    - Rejections: `32/01`, `13/13/2026`, garbage text
  - Modal tests in `WheelDatePickerModal.test.tsx`:
    - Typing `13/9/26` confirms `2026-09-13`
    - Typing `Sep 13` confirms September 13
    - Typing `+1w` confirms 7 days in future
  - Local Gradle debug APK build (`:app:assembleDebug`).
  - ADB installation onto Xiaomi MI 9 (`96d9c774`).
  - Live on-device testing:
    - Exercise typing `13/9/26`, `Sep 13`, and `+1w`.
    - Verify live wheels spin to match.
    - Confirm date into the parent form.
- Non-functional:
  - 100% test pass rate across mobile test suite.
  - Clean TypeScript typecheck (0 errors).

## Architecture
```
Test & Build Pipeline
┌────────────────────────────────────────────────────────┐
│ 1. Exhaustive Parser Tests (naturalDateParser.test.ts) │
├────────────────────────────────────────────────────────┤
│ 2. Modal Integration Tests (WheelDatePickerModal.test) │
├────────────────────────────────────────────────────────┤
│ 3. Workspace Typecheck (tsc --noEmit)                  │
├────────────────────────────────────────────────────────┤
│ 4. Local Gradle Build (:app:assembleDebug)             │
├────────────────────────────────────────────────────────┤
│ 5. ADB Streamed Install on Xiaomi MI 9                 │
├────────────────────────────────────────────────────────┤
│ 6. Live Physical Device Verification via ADB           │
└────────────────────────────────────────────────────────┘
```

## Related Code Files
- Test: `apps/mobile/src/utils/__tests__/naturalDateParser.test.ts`
- Test: `apps/mobile/src/components/WheelDatePickerModal.test.tsx`
- Build: `apps/mobile/android/`

## Implementation Steps
1. Create `naturalDateParser.test.ts` with test groups for each input pattern.
2. Run Jest and confirm all test cases pass.
3. Run `pnpm --filter mobile typecheck` and verify 0 errors.
4. Compile Android debug APK via Gradle.
5. Install via ADB: `adb -s 96d9c774 install -r .../app-debug.apk`.
6. Launch MainActivity and exercise typing `13/9/26` and `Sep 13` live on device.
7. Capture screenshots and verify database persistence.

## Success Criteria
- [x] 100% passing tests for natural date parser matrix.
- [x] Clean typecheck across mobile workspace.
- [x] Android APK built and installed on Xiaomi MI 9.
- [x] Live device test confirms typing `13/9/26`, `Sep 13`, and `+1w` works smoothly.

## Risk Assessment
- Risk: Edge-case timezone discrepancies when parsing dates without hours.
  - Mitigation: Use UTC-normalized dates or local year/month/day tuples (`{ year, month, day }`) instead of Date timestamps to prevent cross-timezone date shifting.
