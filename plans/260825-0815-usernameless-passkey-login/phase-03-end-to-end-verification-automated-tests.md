---
phase: 3
title: "End-to-End Verification & Automated Tests"
status: pending
priority: P1
dependencies: [1, 2]
---

# Phase 3: End-to-End Verification & Automated Tests

<!-- Updated: Validation Session 1 - Test coverage for optional email hint, mild cancellation notice, and enrollment prompt -->
<!-- Updated: Red Team Review - Tests for base64url normalization, challenge single-use cleanup in finally, Android cancellation variants, and double-tap prevention -->

## Overview
Implement automated unit and integration tests across both the API backend and React Native mobile application to verify usernameless passkey login, registration with discoverable resident keys, cancellation handling with mild user notice, optional email filtering, credential ID normalization, and Android cancellation variations.

## Requirements

### Functional Requirements
- **Backend Integration Tests (`api/tests/integration/passkey.test.ts`)**:
  - Test `POST /v1/auth/passkey/register/options` generates options specifying `residentKey: 'required'` and `authenticatorAttachment: 'platform'`.
  - Test `POST /v1/auth/passkey/login/options` with empty body `{}` generates options with challenge and empty/omitted `allowCredentials`.
  - Test `POST /v1/auth/passkey/login/options` with email generates options containing allowed credentials for that user as a filter hint.
  - Test `POST /v1/auth/passkey/login/verify` successfully consumes challenge from `passkey:challenge:login:chal:<challenge>` when assertion contains matching credential ID (including unnormalized / padded base64 strings).
  - Test `POST /v1/auth/passkey/login/verify` deletes Redis challenge even on signature failure (strictly single-use; replay fails with 401).
  - Test `POST /v1/auth/passkey/login/verify` verifies Android APK hash origins (`android:apk-key-hash:...`).
- **Mobile Unit Tests (`apps/mobile/__tests__/routes/sign-in.test.tsx`)**:
  - Test tapping "Use a passkey" without typing any email invokes `Passkey.get` with empty allow credentials and successfully signs in and updates session store.
  - Test tapping "Use a passkey" with pre-entered email passes email as filter hint to `passkeyLoginOptions`.
  - Test tapping "Use a passkey" when user cancels native prompt with iOS `UserCancelled` and Android `GetCredentialCancellationException`: resets loading and displays a mild notice ("Passkey sign-in cancelled").
  - Test rapid double-pressing "Use a passkey" only invokes native `Passkey.get` once.
  - Test tapping "Use a passkey" when native passkey returns `NoCredentials` displays actionable guidance.
- **Mobile Passkey Registration Unit Tests (`apps/mobile/__tests__/routes/add-passkey.test.tsx`)**:
  - Verify `registerPasskey()` creates discoverable passkeys without disabling resident keys or removing platform attachment in `sanitizeCreateOptions`.

### Non-Functional Requirements
- **Test Isolation**: Tests must run deterministically in CI without external network or device dependencies.
- **Coverage**: 100% path coverage for new/modified branches in `passkey.ts` and `sign-in.tsx`.

## Test Plan & Test Cases

```
┌──────────────────────────────────────────────────────────────┐
│ Backend Integration Suite: api/tests/integration/passkey.ts  │
├──────────────────────────────────────────────────────────────┤
│ 1. register/options returns residentKey: 'required' & plat   │
│ 2. login/options with {} returns valid challenge & no allow  │
│ 3. login/options with {email} returns user credential IDs    │
│ 4. login/verify with discoverable assertion logs user in     │
│ 5. login/verify normalizes unpadded & padded base64 cred IDs │
│ 6. login/verify challenge cleanup on failure (no replay)     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Mobile Route Suite: apps/mobile/__tests__/routes/sign-in.tsx │
├──────────────────────────────────────────────────────────────┤
│ 1. 1-tap passkey sign-in without email -> success            │
│ 2. 1-tap passkey sign-in with email hint -> success          │
│ 3. passkey dismissal (iOS & Android variants) -> mild notice │
│ 4. rapid double-tap -> single execution (in-flight guard)    │
│ 5. passkey error (NoCredentials) -> surfaces recovery text   │
└──────────────────────────────────────────────────────────────┘
```

## Related Code Files
- Modify: `api/tests/integration/passkey.test.ts`
- Modify: `apps/mobile/__tests__/routes/sign-in.test.tsx`
- Modify: `apps/mobile/__tests__/routes/add-passkey.test.tsx`

## Implementation Steps
1. **Add Backend Tests in `api/tests/integration/passkey.test.ts`**:
   - Add test case for anonymous/usernameless login options (`POST /v1/auth/passkey/login/options` with `{}`).
   - Verify `res.json().challenge` exists, `rp.id` matches, and `allowCredentials` is undefined or empty.
   - Add test case with email filter hint.
   - Add verification test checking credential ID normalization and Redis single-use challenge deletion on failure.
2. **Add Mobile Tests in `apps/mobile/__tests__/routes/sign-in.test.tsx`**:
   - Mock `Passkey.get` from `react-native-passkey`.
   - Add test case for 1-tap passkey login with empty email field.
   - Add test case for passkey login with pre-typed email.
   - Add test case for native prompt cancellation (both `UserCancelled` and `GetCredentialCancellationException`), asserting mild notice is rendered and loading state is cleared.
   - Add test case for double-tap prevention.
3. **Execute and Verify**:
   - Run `pnpm --filter @expyrico/api test` to verify API tests.
   - Run `pnpm --filter @expyrico/mobile test` to verify Mobile tests.

## Success Criteria
- [ ] All backend passkey integration tests pass cleanly.
- [ ] All mobile sign-in and passkey unit tests pass cleanly.
- [ ] No regression across existing authentication or test suites.

## Risk Assessment
- **Risk**: Mocking `react-native-passkey` across different platform error shapes in Jest.
  - **Mitigation**: Ensure test mock covers both object error `{ error: 'UserCancelled' }` and Error instance with Android exception class names.
