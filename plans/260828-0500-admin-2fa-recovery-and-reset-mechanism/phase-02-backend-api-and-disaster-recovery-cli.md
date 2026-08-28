---
phase: 2
title: Backend API and Disaster Recovery CLI
status: completed
priority: P1
dependencies:
  - '1'
---

# Phase 2: Backend API and Disaster Recovery CLI

## Overview
Implement the administrative 2FA reset route in the Fastify backend with atomic database transactions, in-memory cache clearing, session invalidation, trusted device revocation, and audit logging. Provide a standalone disaster-recovery CLI script for server operators.

## Requirements

### Functional
- **API Endpoint**: `POST /v1/admin/users/:id/reset-2fa`
  - Gated by `app.requireAdmin`.
  - Path param: `id` (UUID of the target user/admin).
  - Optional body: `adminUserReset2faRequestSchema`.
  - Validates that the target user exists and currently has 2FA enabled (`totpEnabledAt !== null` or `totpSecret !== null`). If not, returns 400 `CANNOT_RESET_UNENROLLED_2FA`.
  - If an admin is resetting their own 2FA (`req.user.id === id`), verify `confirmSelfReset === true` to avoid accidental session cutoffs.
- **Atomic Database Purge**:
  In a single Prisma transaction (`prisma.$transaction`):
  1. Update `User`: set `totpSecret = null`, `totpEnabledAt = null`, `tokenVersion = tokenVersion + 1`.
  2. Delete all existing `TotpRecoveryCode` rows for the user.
  3. Revoke all active `AdminTrustedDevice` entries (`revokedAt: new Date()`).
  4. Revoke all active `Session` entries (`revokedAt: new Date()`).
  5. Delete any unconsumed `TotpChallenge` rows for the user.
- **In-Memory Cache Cleanup**:
  - Export and invoke `clearPendingEnrollment(userId)` from `api/src/services/auth/totp.ts` / `api/src/routes/auth/totp.ts` to delete any in-flight or abandoned `PENDING_ENROLLMENTS` entries, ensuring the user receives a freshly generated TOTP secret on their next re-enrollment attempt.
- **Audit Logging**: Record `user.2fa_reset` via `req.auditLog` capturing operator admin ID, target user ID, IP address, and previous 2FA status.
- **Disaster Recovery CLI Tool**:
  - Script: `api/prisma/reset-admin-2fa.ts`
  - Executed via `"admin:reset-2fa": "tsx --env-file=.env prisma/reset-admin-2fa.ts"` in `api/package.json`.
  - Directly queries Postgres, validates user exists and has `role === 'admin'`, performs identical atomic transaction, and outputs confirmation.

### Non-Functional
- Strict transaction atomicity: partial resets must never occur.
- Immediate token revocation: bumping `tokenVersion` guarantees existing Bearer JWTs are rejected immediately by `authPlugin`.
- Clear, descriptive error responses following the RFC 7807 problem details pattern used across Expyrico.

## Architecture

```
Client (Admin Web or CLI)
        │
        ▼
POST /v1/admin/users/:id/reset-2fa (requireAdmin)
        │
        ▼
   Prisma $transaction
   ├── User: totpSecret=null, totpEnabledAt=null, tokenVersion++
   ├── TotpRecoveryCode.deleteMany(userId)
   ├── AdminTrustedDevice.updateMany(revokedAt=now)
   ├── Session.updateMany(revokedAt=now)
   └── TotpChallenge.deleteMany(userId)
        │
        ▼
   clearPendingEnrollment(userId) ──> Purge in-memory PENDING_ENROLLMENTS
        │
        ▼
   AuditLog ('user.2fa_reset') ──> Return 200 OK
```

## Related Code Files
- Create: `api/src/routes/admin/users/reset-2fa.ts`
- Create: `api/prisma/reset-admin-2fa.ts`
- Modify: `api/src/routes/admin/users/index.ts`
- Modify: `api/src/routes/auth/totp.ts`
- Modify: `api/package.json`

## Implementation Steps
1. In `api/src/routes/auth/totp.ts`:
   - Export `clearPendingEnrollment(userId: string)` to delete entries from `PENDING_ENROLLMENTS` and `ENROLLMENT_BUILDS`.
2. Create `api/src/routes/admin/users/reset-2fa.ts`:
   - Parse `params` with `z.object({ id: z.string().uuid() })`.
   - Validate target user existence and 2FA status in database.
   - Guard self-reset with `confirmSelfReset` check.
   - Execute atomic Prisma transaction (`prisma.$transaction`).
   - Call `clearPendingEnrollment(id)`.
   - Write audit log entry.
   - Return `{ ok: true, userId: id, message: 'Two-factor authentication has been reset. User will be prompted to re-enroll on next sign in.' }`.
3. In `api/src/routes/admin/users/index.ts`:
   - Register `adminUsersReset2faRoute` under the admin users route plugin.
4. Create `api/prisma/reset-admin-2fa.ts`:
   - Parse `--email` argument or prompt if missing.
   - Connect via Prisma client and execute the identical atomic 2FA reset sequence.
   - Print clear terminal feedback with instructions for logging in at the admin portal.
5. In `api/package.json`:
   - Add script: `"admin:reset-2fa": "tsx --env-file=.env prisma/reset-admin-2fa.ts"`.

## Success Criteria
- [ ] `POST /v1/admin/users/:id/reset-2fa` successfully resets 2FA and returns 200 OK.
- [ ] Mismatched / unconfigured users receive 400 `CANNOT_RESET_UNENROLLED_2FA`.
- [ ] Active JWTs of the target user are rejected on subsequent requests due to `tokenVersion` increment.
- [ ] In-memory enrollment caches are invalidated.
- [ ] Trusted devices and sessions are revoked.
- [ ] Disaster recovery CLI script runs cleanly and resets admin accounts via terminal.

## Risk Assessment
- **Risk**: Stale sessions remaining active if `tokenVersion` or `session` revocation fails.
- **Mitigation**: Perform all state changes inside a single `prisma.$transaction` block.
