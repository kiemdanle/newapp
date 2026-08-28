---
phase: 4
title: Security Hardening and Automated Testing
status: completed
priority: P1
dependencies:
  - '1'
  - '2'
  - '3'
---

# Phase 4: Security Hardening and Automated Testing

## Overview
Perform security hardening, comprehensive integration testing across all edge cases (token revocation, trusted device invalidation, audit logging, unauthorized attempts), and full-workspace typecheck verification.

## Requirements

### Functional
- Comprehensive integration tests in `api/tests/integration/admin/users-reset-2fa.test.ts`.
- Verify every database side-effect of the atomic 2FA reset:
  - `user.totpSecret === null` and `user.totpEnabledAt === null`.
  - `user.tokenVersion` is incremented by 1.
  - All `TotpRecoveryCode` records for the user are deleted.
  - All `AdminTrustedDevice` records for the user have `revokedAt !== null`.
  - All `Session` records for the user have `revokedAt !== null`.
  - All `TotpChallenge` records for the user are deleted.
  - An `AdminAuditLog` entry is created with action `user.2fa_reset` and correct before/after metadata.
- Verify security boundaries:
  - A user with role `user` calling the reset route receives `403 Forbidden`.
  - Calling reset on a user with no 2FA configured receives `400 CANNOT_RESET_UNENROLLED_2FA`.
  - Active access tokens issued prior to the reset fail subsequent authenticated requests (`401 Unauthorized`).
- Verify subsequent login lifecycle:
  - Reset admin logging in with password receives `{ requiresTotpEnrollment: true, enrollmentChallenge }`.
  - Completing enrollment generates a new secret, stores 10 fresh recovery codes, and enables normal login.

### Non-Functional
- Zero regressions across existing auth and TOTP integration tests (`api/tests/integration/totp.test.ts`, `api/tests/integration/admin-trusted-device.test.ts`, `api/tests/integration/login.test.ts`).
- 100% type safety verified across `@expyrico/shared`, `@expyrico/api`, and `apps/admin`.

## Architecture & Test Matrix

| Test Case | Scenario | Expected Outcome |
|:----------|:---------|:-----------------|
| `TC-01` | Active Admin resets 2FA for another admin | 200 OK, atomic DB purge, audit log written |
| `TC-02` | Stolen/Active JWT verification after reset | 401 Unauthorized (tokenVersion mismatch) |
| `TC-03` | Non-admin tries to reset 2FA | 403 Forbidden |
| `TC-04` | Reset 2FA on account without 2FA | 400 Bad Request (`cannot_reset_unenrolled_2fa`) |
| `TC-05` | Post-reset login and re-enrollment | Forced enrollment challenge -> fresh QR & recovery codes |
| `TC-06` | Disaster Recovery CLI execution | Script executes and resets admin in DB without web server |

## Related Code Files
- Create: `api/tests/integration/admin/users-reset-2fa.test.ts`
- Modify: `api/tests/integration/totp.test.ts` (if assertions are extended)

## Implementation Steps
1. Create `api/tests/integration/admin/users-reset-2fa.test.ts`:
   - Setup test fixtures with `makeAdmin()` and helper to enroll TOTP and create trusted devices & recovery codes.
   - Test TC-01: Execute `POST /v1/admin/users/:id/reset-2fa` and verify all database tables.
   - Test TC-02: Issue access token before reset, trigger reset, assert old token is rejected on `/v1/auth/me`.
   - Test TC-03: Attempt call with non-admin bearer token; assert 403.
   - Test TC-04: Call reset on freshly registered user without 2FA; assert 400.
   - Test TC-05: Complete full post-reset login cycle: `/login` -> `requiresTotpEnrollment` -> `/totp/enroll` -> `/totp/verify-enrollment` -> subsequent TOTP login.
2. Run test suites:
   - `pnpm --filter @expyrico/api test api/tests/integration/admin/users-reset-2fa.test.ts`
   - `pnpm --filter @expyrico/api test api/tests/integration/totp.test.ts`
3. Run workspace typechecks:
   - `pnpm --filter @expyrico/shared build`
   - `pnpm --filter @expyrico/api typecheck`
   - `pnpm --filter expyrico-admin typecheck`

## Success Criteria
- [ ] All new integration tests pass with 100% assertions satisfied.
- [ ] No regression in existing auth or admin test suites.
- [ ] Full workspace build and typechecks pass with zero errors.

## Risk Assessment
- **Risk**: Flaky tests due to timer/date assertions in audit logs or token expiry.
- **Mitigation**: Use relative date comparisons and transactional test database isolation.
