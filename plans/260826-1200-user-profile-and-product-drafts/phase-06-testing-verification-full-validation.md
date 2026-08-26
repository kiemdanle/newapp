---
phase: 6
title: "Testing Verification & Full Validation"
status: pending
priority: P1
dependencies: [
  "phase-01-data-model-shared-schemas.md",
  "phase-02-backend-api-routes-services.md",
  "phase-03-country-locale-regional-formatting-engine.md",
  "phase-04-mobile-profile-security-screens.md",
  "phase-05-product-drafts-creation-ux-fixes.md"
]
---

# Phase 6: Testing Verification & Full Validation

## Overview
This phase executes a rigorous test and verification matrix across the backend API, regional formatting engine, mobile profile components, password security flows, and product draft creation features, culminating in an Android debug build verification.

## Test Matrix & Verification Coverage

```
+-----------------------------------------------------------------------------------------+
|                                  Full Verification Matrix                               |
+-----------------------------------------------------------------------------------------+
| Layer       | Target Area         | Test Type   | Verification Goal                     |
+-------------+---------------------+-------------+---------------------------------------+
| Backend     | User Address & Repo | Unit        | toApiUser maps address & hasPassword  |
| Backend     | PATCH /me           | Integration | Validates & persists profile fields   |
| Backend     | PUT /me/password    | Integration | Verifies current pwd, sets new pwd    |
| Backend     | POST /me/avatar     | Integration | Sharp crops to square WebP, sets URL  |
| Shared      | Country Engine      | Unit        | Formats dates, currencies, numbers    |
| Mobile      | Avatar Component    | Unit        | Image load vs fallback initials       |
| Mobile      | Edit Profile Screen | Integration | Submits updates & refreshes session   |
| Mobile      | Password Screen     | Integration | Enforces 8+ chars & password match    |
| Mobile      | Drafts Screen CTA   | Integration | Triggers scan & manual barcode modal  |
| Native/App  | Mobile Build        | Build       | Gradle assembleDebug succeeds         |
+-----------------------------------------------------------------------------------------+
```

## Requirements

### Automated Test Specifications
1. **Backend Integration Tests (`api/tests/integration/me-profile-and-security.test.ts`)**:
   - `PATCH /me`: updates first name, last name, address, country, and theme preference.
   - `PUT /me/password`:
     - Returns 400 when `currentPassword` is incorrect.
     - Successfully changes password when `currentPassword` is valid.
     - Allows passwordless user to set a new password without `currentPassword`.
     - Validates that user can immediately authenticate via `POST /auth/login` using the newly set password.
   - `POST /me/avatar` & `DELETE /me/avatar`:
     - Uploads sample JPEG/PNG image, verifies that 256x256 WebP file is stored and `avatarUrl` is returned.
     - Rejects non-image and oversized (>5MB) uploads with 415 / 413 errors.
     - Deletes avatar and confirms `avatarUrl` is null.
2. **Country & Formatting Unit Tests (`apps/mobile/src/utils/country-format.test.ts`)**:
   - Tests `formatCurrency` with USD, GBP, EUR, VND, JPY.
   - Tests `formatDate` and `formatTime` with US (`MM/DD/YYYY`), GB/VN (`DD/MM/YYYY`), DE/JP (`YYYY/MM/DD`).
   - Tests fallback behavior on null/invalid country codes.
3. **Mobile Screen Unit & Component Tests (`apps/mobile/src/features/profile/*.test.tsx`)**:
   - `Avatar.test.tsx`: tests image rendering, error fallback to initials, and camera badge click.
   - `EditProfileScreen.test.tsx`: tests pre-population, form field editing, country modal selection, and submit mutation.
   - `PasswordScreen.test.tsx`: tests password validation rules, mismatch errors, and change submission.
   - `ProductDraftsScreen.test.tsx`: tests presence of "+ Add Draft" button, empty state action triggers, and manual code entry modal flow.
4. **Android Build Verification**:
   - Verify that the native Android Gradle project compiles cleanly without type or native resource errors.

## Related Code Files
- Create: `api/tests/integration/me-profile-and-security.test.ts`
- Create: `apps/mobile/src/utils/country-format.test.ts`
- Create: `apps/mobile/src/components/Avatar.test.tsx`
- Create: `apps/mobile/src/features/profile/EditProfileScreen.test.tsx`
- Create: `apps/mobile/src/features/profile/PasswordScreen.test.tsx`
- Create: `apps/mobile/app/(app)/product/drafts.test.tsx`

## Implementation & Execution Steps
1. Run backend unit and integration tests:
   ```bash
   pnpm --filter @expyrico/api test api/tests/integration/me-profile-and-security.test.ts
   ```
2. Run shared package tests and build:
   ```bash
   pnpm --filter @expyrico/shared test
   pnpm --filter @expyrico/shared build
   ```
3. Run mobile Jest tests:
   ```bash
   pnpm --filter @expyrico/mobile test
   ```
4. Run Android debug build verification:
   ```bash
   cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
   ```

## Success Criteria
- [ ] All backend profile, password, and avatar tests pass (0 failures).
- [ ] All country formatting and regional locale tests pass.
- [ ] All mobile profile and drafts UI tests pass.
- [ ] TypeScript type checks pass across monorepo packages (`pnpm typecheck`).
- [ ] Android debug APK builds successfully via local Gradle toolchain.

## Risk Assessment
- **Risk**: Test environment missing media root directory for avatar upload tests.
  - **Mitigation**: Create temporary fixture directories in `beforeAll` / `afterAll` test hooks.
- **Risk**: Native build classpath conflict with Android Gradle Plugin.
  - **Mitigation**: Use local project Gradle wrapper with configured `JAVA_HOME` and `ANDROID_HOME` env vars.
