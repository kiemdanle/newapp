---
phase: 7
title: "Camera and OCR capabilities"
status: pending
priority: P1
dependencies: [5]
---

# Phase 7: Camera and OCR capabilities

## Overview

Second half of the capability replacements: the camera group, including the OCR surface the original plan missed (red-team F6). Replaces both `expo-camera` consumers with Vision Camera and wires the FCM permission/token plumbing (consumed by phase 8). Owns scan/expiry/push files; may run parallel to phase 6.

## Requirements

- Functional: barcode scan via Vision Camera + barcode integration; expiry-date OCR via Vision Camera photo capture + `@react-native-ml-kit/text-recognition`; scan permission flow preserved; FCM permission + `getToken()` plumbing exists behind a guard.
- Non-functional: credential-free/uninitialized-Firebase build makes push registration a no-op, not a crash; the FCM token is NOT emitted onto the wire in a rejected format before phase 8 (red-team F1/F2 — see note).

## Architecture

**Two camera surfaces (red-team F6 — original plan only scoped `scan/*`):**
- `src/features/scan/ScanCamera.tsx` + `usePermission.ts` → Vision Camera + barcode scanning.
- `src/features/expiry/OcrCamera.tsx` uses `expo-camera` `CameraView` + `@react-native-ml-kit/text-recognition`. Migrate to Vision Camera photo capture → ML Kit text recognition. Confirm the ML Kit module autolinks under bare RN 0.76.9 on both hosts (tracked in the phase-2 inventory).
- `src/tests/ScanCamera.test.tsx` → non-Expo camera mocks.

**FCM plumbing (coordinated with phase 8, red-team F1):** convert `src/features/push/registerPushToken.ts` from `Notifications.getExpoPushTokenAsync()` to RN Firebase messaging permission + `getToken()`. CRITICAL: this phase wires permission + token acquisition behind a guard, but MUST NOT send a native-format token to the API while the shared validator still enforces the Expo regex (`record.ts:115`). Either keep registration disabled here and enable it in phase 8's source-atomic cutover commit, or gate emission on a flag flipped in phase 8. Uninitialized Firebase → registration no-op (not crash).

## Related Code Files

- Modify: `src/features/scan/ScanCamera.tsx`, `src/features/scan/usePermission.ts`, `src/features/expiry/OcrCamera.tsx`, `src/tests/ScanCamera.test.tsx`
- Modify: `src/features/push/registerPushToken.ts` (FCM permission + getToken plumbing, emission gated for phase 8)

## Implementation Steps

1. Replace scan camera + permission with Vision Camera + barcode; preserve the permission flow and scan results.
2. Migrate `OcrCamera.tsx` to Vision Camera capture + ML Kit text recognition; verify ML Kit autolinks (per phase-2 inventory).
3. Wire FCM permission + `getToken()` in `registerPushToken.ts` with an uninitialized-Firebase no-op guard; keep native-token emission disabled/flagged until phase 8.
4. Update camera tests/mocks to non-Expo equivalents; typecheck + lint.

## Success Criteria

- [ ] No `expo-camera` import remains in `scan/*`, `expiry/OcrCamera.tsx`, or scan tests; both barcode and OCR paths work via Vision Camera.
- [ ] ML Kit text-recognition confirmed to autolink on the target host(s).
- [ ] FCM permission + `getToken()` plumbing present; native token NOT emitted onto the wire yet (no rejected-format registration window); uninitialized-Firebase build does not crash.
- [ ] Camera/OCR tests + typecheck + lint pass.

## Risk Assessment

- OCR architecture differs from barcode (capture-then-recognize vs frame processor) → design OCR explicitly; don't assume "camera + barcode" covers it.
- Emitting native token before the validator accepts it (F1) → emission gated; enabled only in phase 8's source-atomic cutover commit.
- Vision Camera new-arch config on Android → validated in phase 2's per-module build.
