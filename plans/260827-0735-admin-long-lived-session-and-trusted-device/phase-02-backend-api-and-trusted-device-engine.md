---
phase: 2
title: Backend API and Trusted Device Engine
status: completed
priority: P1
dependencies:
  - 1
---

# Phase 2: Backend API and Trusted Device Engine

## Overview
Implements the core server-side trusted device engine in Fastify (`api`), including secure token generation and hashing, user-scoped device verification, 60-day expiry enforcement, OTP challenge bypass on trusted devices in `POST /v1/auth/login`, trusted device issuance in `POST /v1/auth/totp/challenge-verify`, self-service device management endpoints (`GET /v1/admin/trusted-devices`, `DELETE /v1/admin/trusted-devices/:id`), and automatic security invalidation on password resets, user status changes, or role demotions.

## Requirements
### Functional
- **Trusted Device Service (`api/src/services/auth/trusted-devices.ts`)**:
  - `issueTrustedDeviceToken(userId, context)`: Generates 32-byte cryptographically secure random token, computes SHA-256 hash, stores in `AdminTrustedDevice` with 60-day expiry (`Date.now() + 60 * 24 * 60 * 60 * 1000`), client IP, and User-Agent metadata. Returns `{ token, expiresAt }`.
  - `verifyTrustedDeviceToken(userId, rawToken)`: Computes SHA-256 hash, queries `AdminTrustedDevice` strictly with `where: { tokenHash, userId, revokedAt: null, expiresAt: { gt: new Date() } }`. Updates `lastUsedAt` and `ip` on match. Returns `boolean`.
  - `listAdminTrustedDevices(userId)`: Returns all non-revoked, non-expired trusted devices for the admin.
  - `revokeTrustedDevice(id, userId)`: Explicitly sets `revokedAt = new Date()` strictly scoped to `where: { id, userId }`.
  - `revokeAllTrustedDevices(userId)`: Explicitly sets `revokedAt = new Date()` for all active devices belonging to `userId`.
- **`POST /v1/auth/login`**:
  - Accepts optional `trustedDeviceToken?: string`.
  - When credentials match an active admin user:
    - If `trustedDeviceToken` is present AND `verifyTrustedDeviceToken(user.id, trustedDeviceToken)` returns `true`:
      - **Bypass TOTP challenge!**
      - Immediately issue `accessToken` + `refreshToken`, create `Session`, and return `{ user: toApiUser(user), tokens: { accessToken, refreshToken, expiresIn } }`.
    - Otherwise (no token, expired token, revoked token, invalid hash, or mismatched user):
      - Fallback to normal TOTP step: generate `challengeToken`, return `{ requiresTotp: true, challengeToken }`.
- **`POST /v1/auth/totp/challenge-verify` and `POST /v1/auth/totp/recovery-verify`**:
  - Accepts optional `trustDevice?: boolean`.
  - On valid TOTP verification:
    - If `trustDevice === true`:
      - Call `issueTrustedDeviceToken(user.id, { ip: req.ip, userAgent: req.headers['user-agent'] })`.
      - Include `trustedDeviceToken` in response payload along with `user` and `tokens`.
- **Admin Self-Service Device Management Endpoints**:
  - `GET /v1/admin/trusted-devices`: Authenticated admin route returning `{ devices: AdminTrustedDeviceRow[] }`.
  - `DELETE /v1/admin/trusted-devices/:id`: Authenticated admin route revoking a specific device for `req.user.id`.
- **Security Invalidation Hooks**:
  - When an admin password is changed or reset (`api/src/routes/auth/reset-password.ts`, `api/src/routes/me/password.ts`), call `revokeAllTrustedDevices(user.id)` and `revokeAllSessions(user.id)`.
  - When an admin's role is demoted or status changes to suspended/deleted in `api/src/routes/admin/users/patch.ts`, call `revokeAllTrustedDevices(userId)` and `revokeAllSessions(userId)` immediately.

<!-- Updated: Red Team Review Session 1 - Added explicit userId binding in verify query and hooked revocation into admin user patch route (role demotion/suspension) -->

### Non-Functional
- **Timing Attack Resilience & Cross-Account Isolation**: Constant-time token verification using SHA-256 hash matching strictly scoped to the authenticating `userId`.
- **Strict Expiration**: 60-day maximum lifetime strictly enforced at the database query level (`expiresAt > new Date()`).
- **Audit Logging**: Successful trusted device authentications, device enrollments, and explicit revocations logged for security monitoring.

## Architecture
```
+------------------------------------------------------------------------------------+
|                                POST /v1/auth/login                                 |
+------------------------------------------------------------------------------------+
                                           |
                                [Verify Email & Password]
                                           |
                                [Is Role === 'admin'?]
                               /                      \
                             No                        Yes
                             /                          \
              [Issue Tokens & Session]            [Is trustedDeviceToken valid for user.id?]
                                                  /                                     \
                                                Yes                                      No
                                                /                                         \
                                   [Update lastUsedAt]                       [Issue TOTP ChallengeToken]
                                   [Issue Tokens & Session]                  [Return { requiresTotp: true }]
                                   [Bypass TOTP Screen!]
```

## Related Code Files
- Create: `api/src/services/auth/trusted-devices.ts`
- Modify: `api/src/routes/auth/login.ts`
- Modify: `api/src/routes/auth/totp.ts`
- Create: `api/src/routes/admin/trusted-devices.ts`
- Modify: `api/src/routes/admin/index.ts`
- Modify: `api/src/routes/admin/users/patch.ts`
- Modify: `api/src/routes/auth/reset-password.ts`
- Modify: `api/src/routes/me/password.ts`
- Create: `api/tests/unit/trusted-devices.test.ts`
- Create: `api/tests/integration/admin-trusted-device.test.ts`

## Implementation Steps
1. **Create Trusted Device Service**:
   - Implement `issueTrustedDeviceToken`, `verifyTrustedDeviceToken`, `listAdminTrustedDevices`, `revokeTrustedDevice`, and `revokeAllTrustedDevices` in `api/src/services/auth/trusted-devices.ts` using `randomToken(32)` and `hashToken()`. Ensure all lookups are scoped by `userId`.
2. **Update `POST /v1/auth/login`**:
   - Parse `trustedDeviceToken` from request body.
   - If `user.role === 'admin'`, check `trustedDeviceToken` via `verifyTrustedDeviceToken(user.id, input.trustedDeviceToken)`.
   - If valid, skip TOTP creation, issue access and refresh tokens, and return `{ user, tokens }`.
   - If invalid/missing, continue existing TOTP challenge creation.
3. **Update `POST /v1/auth/totp/challenge-verify` and `/totp/recovery-verify`**:
   - Parse `trustDevice` boolean flag from body.
   - If `trustDevice === true`, call `issueTrustedDeviceToken(user.id, { ip: req.ip, userAgent: req.headers['user-agent'] })`.
   - Return `{ user, tokens, trustedDeviceToken }`.
4. **Implement Admin Device Management Routes**:
   - Create `api/src/routes/admin/trusted-devices.ts` with `GET /v1/admin/trusted-devices` and `DELETE /v1/admin/trusted-devices/:id`.
   - Register under admin router.
5. **Wire Password Change, Reset, & User Patch Security Revocation**:
   - Ensure `revokeAllTrustedDevices(userId)` is called in password reset, password update, and `admin/users/patch.ts` (when status !== active or role !== admin).
6. **Write Unit and Integration Tests**:
   - Add unit tests for `trusted-devices.ts` covering issuance, user-scoped hash verification, listing, expiry detection, and revocation.
   - Add integration tests in `api/tests/integration/admin-trusted-device.test.ts` testing the complete login -> TOTP with trust -> subsequent login bypassing TOTP -> device revocation flow.

## Success Criteria
- [ ] `issueTrustedDeviceToken` generates a 32-byte token and saves a SHA-256 hash with 60-day expiry.
- [ ] `POST /v1/auth/login` with a valid user-matched trusted device token grants an authenticated session without requiring TOTP.
- [ ] `POST /v1/auth/login` with a token issued to a different user is rejected and requires TOTP.
- [ ] `POST /v1/auth/totp/challenge-verify` with `trustDevice: true` returns a valid `trustedDeviceToken`.
- [ ] `GET /v1/admin/trusted-devices` and `DELETE /v1/admin/trusted-devices/:id` allow managing trusted devices.
- [ ] Role demotion or account suspension in `admin/users/patch.ts` revokes all active trusted devices.
- [ ] All new integration tests pass with 100% assertions.

## Risk Assessment
- **Token Theft / Cookie Exposure**: Mitigated by HttpOnly, Secure, and SameSite cookie attributes plus IP/User-Agent tracking.
- **Clock Drift**: Device expiry is calculated against database `NOW()` timestamp.
