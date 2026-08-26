---
phase: 3
title: "Push Repo and Email Resilience"
status: pending
priority: P1
dependencies: [2]
---

# Phase 3: Push Repo and Email Resilience

## Overview
Hardens backend push token storage and transactional authentication emails. Updates `upsertPushToken` to safely reassign device tokens when multiple users share a physical device, adds explicit socket and connection timeouts to the SMTP transport, and wraps email dispatches in non-blocking error boundaries so temporary SMTP outages do not fail user registration.

---

## Requirements

### Functional Requirements
- When a user logs in and registers a device token that previously belonged to another user, `upsertPushToken` must transfer ownership of the token to the newly authenticated user rather than rejecting it with 409 Conflict.
- Provide a dedicated endpoint `POST /me/push-token/revoke-by-token` to support client-side token revocation on logout without requiring the client to store internal DB token UUIDs.
- `sendVerificationEmail` and `sendPasswordResetCodeEmail` must enforce connection, greeting, and socket timeouts on Nodemailer transports.
- An SMTP failure during user registration (`/auth/register`) or resend verification (`/auth/resend-verification`) must not cause the HTTP request to crash with a 500 error after DB rows have already been committed.

### Non-Functional Requirements
- Maintain zero PII leakage in email logs (only log hashed user IDs or delivery outcomes).
- Email templates must strictly adhere to the Expyrico brand palette (`#4BAE8A`, `#3A8F6F`, `#D6F0E6`, `#FAFAF8`, `#F5A623`, `#FEEFC3`, `#F0F0ED`, `#8C8C85`, `#2C2C28`).

---

## Architecture & Code Changes

### 1. Token Ownership Reassignment in Repository
* **`api/src/services/push/repository.ts`**:
  Update `upsertPushToken` to reassign ownership instead of throwing `PushTokenOwnershipError`:
  ```typescript
  export async function upsertPushToken(input: {
    userId: string;
    deviceToken: string;
    platform: 'ios' | 'android';
    deviceInfo?: Record<string, unknown> | undefined;
  }): Promise<PushToken> {
    const prisma = getPrisma();
    const existing = await prisma.pushToken.findUnique({ where: { deviceToken: input.deviceToken } });

    if (existing) {
      // Reassign ownership to the current user and unrevoke the token
      return prisma.pushToken.update({
        where: { id: existing.id },
        data: {
          userId: input.userId,
          platform: input.platform,
          deviceInfo: (input.deviceInfo ?? null) as never,
          lastUsedAt: new Date(),
          revokedAt: null,
        },
      });
    }

    try {
      return await prisma.pushToken.create({
        data: {
          userId: input.userId,
          deviceToken: input.deviceToken,
          platform: input.platform,
          deviceInfo: (input.deviceInfo ?? null) as never,
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Handle concurrent insert race by updating
      return prisma.pushToken.update({
        where: { deviceToken: input.deviceToken },
        data: {
          userId: input.userId,
          platform: input.platform,
          deviceInfo: (input.deviceInfo ?? null) as never,
          lastUsedAt: new Date(),
          revokedAt: null,
        },
      });
    }
  }

  export async function revokePushTokenByDeviceToken(userId: string, deviceToken: string): Promise<boolean> {
    const prisma = getPrisma();
    const token = await prisma.pushToken.findFirst({ where: { userId, deviceToken } });
    if (!token) return false;
    await prisma.pushToken.update({ where: { id: token.id }, data: { revokedAt: new Date() } });
    return true;
  }
  ```

### 2. Push Token Revocation Route
* **`api/src/routes/me/push-token.ts`**:
  Add route:
  ```typescript
  app.post('/push-token/revoke-by-token', { onRequest: app.requireAuth }, async (req, reply) => {
    const { deviceToken } = z.object({ deviceToken: z.string().min(1) }).parse(req.body);
    await revokePushTokenByDeviceToken(req.user!.id, deviceToken);
    return reply.status(204).send();
  });
  ```

### 3. SMTP Timeouts & Error Boundaries
* **`api/src/services/auth/email.ts`**:
  Add network timeouts to SMTP transport:
  ```typescript
  function getTransport(): Transporter {
    if (_transport) return _transport;
    const cfg = getConfig();
    _transport = createTransport({
      host: cfg.smtp.host,
      port: cfg.smtp.port,
      secure: cfg.smtp.port === 465,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      ...(cfg.smtp.user ? { auth: { user: cfg.smtp.user, pass: cfg.smtp.pass } } : {}),
    });
    return _transport;
  }
  ```
* **`api/src/routes/auth/register.ts`**:
  Wrap verification email dispatch in an error boundary:
  ```typescript
  try {
    await sendVerificationEmail(user.email, verificationCode);
  } catch (err) {
    logger.error({ err, userId: user.id }, 'Failed to send verification email on registration');
    // Account and session are created; user can trigger resend in app
  }
  ```
* **`api/src/routes/auth/resend-verification.ts`**:
  Wrap resend in try/catch to guarantee idempotent 204 response without leaking error state.

---

## Related Code Files
- Modify: `api/src/services/push/repository.ts`
- Modify: `api/src/routes/me/push-token.ts`
- Modify: `api/src/services/auth/email.ts`
- Modify: `api/src/routes/auth/register.ts`
- Modify: `api/src/routes/auth/resend-verification.ts`
- Test: `api/tests/unit/services-push-repository.test.ts`
- Test: `api/tests/unit/auth-email.test.ts`

---

## Implementation Steps
1. Update `upsertPushToken` in `repository.ts` to perform reassignments and add `revokePushTokenByDeviceToken`.
2. Add `POST /me/push-token/revoke-by-token` route in `api/src/routes/me/push-token.ts`.
3. Configure `connectionTimeout`, `greetingTimeout`, and `socketTimeout` in `email.ts`.
4. Wrap `sendVerificationEmail` calls in `register.ts` and `resend-verification.ts` with try/catch error boundaries.
5. Write unit tests verifying multi-user token ownership transfers and email failure isolation.

---

## Success Criteria
- [ ] Multiple users logging into the same device consecutively succeed in registering the token.
- [ ] Calling `/me/push-token/revoke-by-token` marks the token as `revokedAt` in PostgreSQL.
- [ ] SMTP connection hangs time out after 10-20 seconds instead of blocking requests indefinitely.
- [ ] If SMTP is offline during user registration, the user account and session are created and a 201 response is returned with logged error.

---

## Risk Assessment
- **Token hijacking risk:** When a token is transferred to a new user, notifications from the previous user must stop immediately. Setting `userId = newUserId` directly guarantees the old user's notification queries (`activeTokensForUser(oldUserId)`) will not return this token.
