---
title: Rename Discard button to Mark as discarded in pantry
date: 2026-09-06
summary: Rename Discard button to Mark as discarded in pantry record details for parallel status semantics
---

# Rename Discard button to Mark as discarded in pantry

Rename Discard button to Mark as discarded in pantry record details for parallel status semantics

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Context & Requirement
In the pantry item detail screen (`apps/mobile/app/(app)/record/[id].tsx`), the bottom floating action toolbar had a naming inconsistency:
- Primary button: "Mark as used"
- Outline button: "Discard"

The requirement is to rename "Discard" to "Mark as discarded" so both actions read as parallel, reversible status changes (matching "Mark as used").

## Changes
1. **`RecordDetail` (`apps/mobile/app/(app)/record/[id].tsx`)**:
   - Renamed button `label="Discard"` to `label="Mark as discarded"` on `testID="record-mark-discarded"`.
   - Balanced the flex layout (`flex: 1` on each action button) in `actionRow`.
2. **Tests (`apps/mobile/tests/unit/record-detail-expiry-card.test.tsx`)**:
   - Added test asserting that both parallel status buttons "Mark as used" and "Mark as discarded" render in the action toolbar.
3. **Build & Deploy**:
   - Built debug APK with local Gradle toolchain (`assembleDebug`).
   - Installed APK to connected device `96d9c774` via `adb install -r`.

## Verification
- Unit test suite: `npm --prefix apps/mobile test -- apps/mobile/tests/unit/record-detail-expiry-card.test.tsx` (3/3 passed).
- TypeScript: `npm --prefix apps/mobile run typecheck` (0 errors).
- Android build: `BUILD SUCCESSFUL in 27s`.
- Adb install: `Success`.
