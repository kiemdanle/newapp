---
phase: 5
title: Verification and End-to-End Testing
status: completed
priority: P1
dependencies:
  - 1
  - 2
  - 3
  - 4
---

# Phase 5: Verification and End-to-End Testing

## Overview
Defines the end-to-end validation strategy, automated test suites, and regression checks across the backend API (`api`), shared contracts (`@expyrico/shared`), and Next.js admin frontend (`apps/admin`). Covers unit tests, integration tests with real PostgreSQL/Redis instances, and Playwright browser E2E tests for the full login, TOTP trust, OTP bypass, device management/revocation, concurrent 401 deduplication, seamless session refresh, and explicit logout flows.

## Requirements
### Functional
- **Backend Unit & Integration Tests (`api/tests/`)**:
  - `api/tests/unit/trusted-devices.test.ts`:
    - Generates 32-byte secure random tokens and stores SHA-256 hashes.
    - Accurately detects expired devices (`expiresAt <= NOW`).
    - Accurately detects revoked devices (`revokedAt IS NOT NULL`).
    - Accurately rejects tokens belonging to a different user ID (cross-account isolation).
    - Updates `lastUsedAt` timestamp upon successful validation.
  - `api/tests/integration/admin-trusted-device.test.ts`:
    - Admin password login without trusted device returns `requiresTotp: true`.
    - `POST /v1/auth/totp/challenge-verify` with `trustDevice: true` returns `trustedDeviceToken` + valid session tokens.
    - Subsequent `POST /v1/auth/login` with `trustedDeviceToken` immediately returns session tokens and bypasses TOTP.
    - `GET /v1/admin/trusted-devices` lists active devices with correct metadata.
    - `DELETE /v1/admin/trusted-devices/:id` revokes the specific device; subsequent login with that device token now requires TOTP again.
    - Role demotion or account suspension in `admin/users/patch.ts` revokes all active trusted devices.
    - Password change or reset immediately invalidates all active trusted devices.
  - `api/tests/integration/sessions.test.ts` / `refresh.test.ts`:
    - Verify 365-day session rotation, grace window handling, and token version validation.
- **Admin App Unit Tests (`apps/admin/tests/unit/`)**:
  - `apps/admin/tests/unit/middleware.test.ts`:
    - Request with valid access cookie -> allowed.
    - Request without access cookie but with valid refresh cookie -> redirects to `/api/auth/refresh-redirect?next=...`.
    - Unauthenticated visit to protected route -> redirects to `/login?next=...`.
    - Visit to `/login` with valid refresh cookie -> redirects to `/api/auth/refresh-redirect?next=/`.
  - `apps/admin/tests/unit/cookies.test.ts`:
    - Verifies 365-day maxAge on refresh and CSRF cookies.
    - Verifies 60-day maxAge on trusted device cookie.
  - `apps/admin/tests/unit/api-client.test.ts`:
    - Verifies that multiple concurrent 401s trigger only a single in-flight `POST /api/auth/refresh` call.
- **Admin App Playwright E2E Tests (`apps/admin/tests/e2e/login.spec.ts`)**:
  - **Scenario 1 (First Login with Trust)**: Admin signs in with password -> enters TOTP with "Trust this device" checked -> successfully lands on `/` with `pantry_admin_trusted_device` cookie set.
  - **Scenario 2 (Subsequent Login on Trusted Device)**: Admin signs in with password -> lands immediately on `/` without seeing the TOTP screen.
  - **Scenario 3 (Explicit Logout)**: Admin clicks "Log out" in Header -> redirected to `/login`, session cookies cleared, but trusted device cookie preserved.
  - **Scenario 4 (Session Refresh)**: Fast-forward access token expiry -> navigating across pages automatically refreshes session without kicking admin to `/login`.
  - **Scenario 5 (Device Revocation)**: Admin revokes trusted device from Settings -> next login prompts for TOTP again.

<!-- Updated: Red Team Review Session 1 - Added concurrent 401 deduplication unit tests and cross-account isolation assertions -->

### Non-Functional
- **Deterministic Test Environment**: Independent test runs with database transaction rollback or UUID isolation.
- **Zero Flakiness**: Explicit wait assertions on URLs and DOM states in Playwright rather than arbitrary sleep timeouts.
- **Full Typecheck**: `npm run typecheck` passes with zero errors across all workspaces.

## Architecture
```
+-----------------------------------------------------------------------------------+
|                            Automated Verification Matrix                          |
+-----------------------------------------------------------------------------------+
| Layer             | Test Suite                    | Coverage Target               |
+-------------------+-------------------------------+-------------------------------+
| @expyrico/shared  | `npm test`                    | Schema validation & types     |
| api (Backend)     | `trusted-devices.test.ts`     | Token hashing, 60d expiry     |
| api (Integration) | `admin-trusted-device.test.ts`| OTP bypass, revoke, isolation |
| apps/admin (Unit) | `middleware.test.ts`          | Refresh handshake redirects   |
| apps/admin (Unit) | `api-client.test.ts`          | Concurrent 401 deduplication  |
| apps/admin (Unit) | `cookies.test.ts`             | 365d / 60d cookie attributes  |
| apps/admin (E2E)  | `login.spec.ts`               | Full browser flow with bypass |
+-------------------+-------------------------------+-------------------------------+
```

## Related Code Files
- Modify: `api/tests/integration/totp.test.ts`
- Create: `api/tests/integration/admin-trusted-device.test.ts`
- Create: `api/tests/unit/trusted-devices.test.ts`
- Modify: `apps/admin/tests/unit/middleware.test.ts`
- Modify: `apps/admin/tests/unit/cookies.test.ts`
- Create: `apps/admin/tests/unit/api-client.test.ts`
- Modify: `apps/admin/tests/e2e/login.spec.ts`
- Modify: `apps/admin/tests/e2e/mock-api.ts`

## Implementation Steps
1. **Implement API Unit Tests**:
   - Write `api/tests/unit/trusted-devices.test.ts` covering token issuance, hashing, user isolation, and revocation functions.
2. **Implement API Integration Tests**:
   - Write `api/tests/integration/admin-trusted-device.test.ts` testing the complete backend authentication lifecycle with and without trusted device tokens, cross-user rejection, and role demotion revocation.
3. **Implement Admin Unit Tests**:
   - Update `apps/admin/tests/unit/middleware.test.ts` to assert every branch of the new 3-state middleware redirect logic.
   - Update `apps/admin/tests/unit/cookies.test.ts` to assert correct maxAge values.
   - Write `apps/admin/tests/unit/api-client.test.ts` testing concurrent 401 refresh deduplication.
4. **Update E2E Mock API and Playwright Tests**:
   - Update `apps/admin/tests/e2e/mock-api.ts` to simulate trusted device token issuance, revocation, and OTP bypass.
   - Update `apps/admin/tests/e2e/login.spec.ts` with tests for OTP bypass, checkbox interaction, explicit logout, and device revocation.
5. **Run Full Verification Pass**:
   - Run `npm test` in `packages/shared`.
   - Run `npm test` in `api`.
   - Run `npm test` in `apps/admin`.
   - Run `npm run typecheck` across all projects.

## Success Criteria
- [ ] 100% of unit and integration tests pass across `api`, `apps/admin`, and `packages/shared`.
- [ ] Concurrent 401 calls in browser client fire only one refresh request.
- [ ] Playwright E2E tests for admin login, trusted devices, and device revocation pass reliably.
- [ ] TypeScript compilation check passes with zero errors.
- [ ] Linting and code format checks pass without warnings.

## Risk Assessment
- **E2E Mock Alignment**: Ensure `mock-api.ts` in Playwright tests matches the actual Fastify API route responses byte-for-byte.
- **Cookie Security Attributes in Test vs Production**: Secure flag should adapt to `env.cookieSecure` so local HTTP testing remains straightforward.
