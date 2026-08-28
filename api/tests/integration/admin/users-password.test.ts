import { describe, expect, it, vi } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUserForAdmin } from '../../helpers/admin.js';
import { createSession } from '../../../src/services/auth/sessions.js';
import { hashToken } from '../../../src/utils/random.js';
import { issueAccessToken } from '../../../src/services/auth/tokens.js';
import { verifyPassword } from '../../../src/services/auth/passwords.js';
describe('POST /v1/admin/users/:id/change-password', () => {
  it('TC-01: Admin successfully changes user password with valid input', async () => {
    const app = await buildServer();
    const prisma = getPrisma();
    const { headers } = await makeAdmin();
    const user = await makeUserForAdmin();

    const newPassword = 'brand-new-super-secure-password-123';
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${user.id}/change-password`,
      headers,
      payload: { password: newPassword },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.userId).toBe(user.id);
    expect(body.message).toContain('successfully');

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updatedUser.passwordHash).not.toBeNull();
    const matches = await verifyPassword(newPassword, updatedUser.passwordHash!);
    expect(matches).toBe(true);

    await app.close();
  });

  it('TC-02: Rejects self-password change with 400 error', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${admin.id}/change-password`,
      headers,
      payload: { password: 'another-strong-password-123' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().title).toContain('Cannot change your own password');

    await app.close();
  });

  it('TC-03: Fails validation when password is too short (<10 chars)', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const user = await makeUserForAdmin();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${user.id}/change-password`,
      headers,
      payload: { password: 'short' },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('TC-04: Increments tokenVersion and revokes active sessions and trusted devices', async () => {
    const app = await buildServer();
    const prisma = getPrisma();
    const { headers } = await makeAdmin();
    const user = await makeUserForAdmin();

    // Create active session and trusted device
    await createSession(user.id);
    await prisma.adminTrustedDevice.create({
      data: {
        userId: user.id,
        tokenHash: hashToken('device-token-1'),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    });

    // Create a pending TOTP challenge
    await prisma.totpChallenge.create({
      data: {
        userId: user.id,
        tokenHash: hashToken('challenge-token-1'),
        purpose: 'login',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    // Generate an access token before the password change
    const oldToken = await issueAccessToken({
      sub: user.id,
      role: 'user',
      tokenVersion: user.tokenVersion,
    });

    const initialTokenVersion = user.tokenVersion;

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${user.id}/change-password`,
      headers,
      payload: { password: 'new-valid-secure-password-123' },
    });

    expect(res.statusCode).toBe(200);

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updatedUser.tokenVersion).toBe(initialTokenVersion + 1);

    const activeSessions = await prisma.session.findMany({
      where: { userId: user.id, revokedAt: null },
    });
    expect(activeSessions).toHaveLength(0);

    const activeDevices = await prisma.adminTrustedDevice.findMany({
      where: { userId: user.id, revokedAt: null },
    });
    expect(activeDevices).toHaveLength(0);

    const pendingChallenges = await prisma.totpChallenge.findMany({
      where: { userId: user.id },
    });
    expect(pendingChallenges).toHaveLength(0);
    // Verify old access token is immediately rejected on /v1/auth/me
    const meRes = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${oldToken}` },
    });
    expect(meRes.statusCode).toBe(401);

    await app.close();
  });

  it('TC-05: Returns 403 for non-admin user', async () => {
    const app = await buildServer();
    const user = await makeUserForAdmin();
    const otherUser = await makeUserForAdmin();

    const token = await issueAccessToken({ sub: user.id, role: 'user', tokenVersion: user.tokenVersion });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${otherUser.id}/change-password`,
      headers: { authorization: `Bearer ${token}` },
      payload: { password: 'new-valid-secure-password-123' },
    });

    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('TC-06: Returns 404 for missing target user', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/users/00000000-0000-0000-0000-000000000000/change-password',
      headers,
      payload: { password: 'new-valid-secure-password-123' },
    });

    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('POST /v1/admin/users/:id/send-random-password', () => {
  it('TC-07: Admin sends random password email, resets passwordHash, and keeps password confidential', async () => {
    const app = await buildServer();
    const prisma = getPrisma();
    const { admin, headers } = await makeAdmin();
    const user = await makeUserForAdmin();

    const oldHash = user.passwordHash;

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${user.id}/send-random-password`,
      headers,
      payload: { notes: 'Customer request over phone' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.userId).toBe(user.id);
    expect(body.message).toContain('temporary random password');
    // Ensure temporary password is NOT returned in body
    expect(body.password).toBeUndefined();
    expect(body.temporaryPassword).toBeUndefined();

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updatedUser.passwordHash).not.toBeNull();
    expect(updatedUser.passwordHash).not.toBe(oldHash);

    // Verify audit log
    const auditLog = await prisma.adminAuditLog.findFirst({
      where: { adminId: admin.id, targetId: user.id, action: 'user.password_reset_email' },
    });
    expect(auditLog).not.toBeNull();
    expect(auditLog?.diff).toEqual({
      before: { passwordSet: true },
      after: { passwordSet: true, method: 'random_email' },
    });

    await app.close();
  });

  it('TC-08: Rejects self-reset random password with 400', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${admin.id}/send-random-password`,
      headers,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().title).toContain('Cannot reset your own password');

    await app.close();
  });

  it('TC-09: Creates password AuthCredential for OAuth-only user', async () => {
    const app = await buildServer();
    const prisma = getPrisma();
    const { headers } = await makeAdmin();

    // Create user without password (OAuth-only)
    const oauthUser = await prisma.user.create({
      data: {
        email: `oauth-${Date.now()}@example.com`,
        passwordHash: null,
        firstName: 'Google',
        lastName: 'User',
        role: 'user',
        emailVerifiedAt: new Date(),
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${oauthUser.id}/change-password`,
      headers,
      payload: { password: 'oauth-converted-password-123' },
    });

    expect(res.statusCode).toBe(200);

    const cred = await prisma.authCredential.findFirst({
      where: { userId: oauthUser.id, type: 'password' },
    });
    expect(cred).not.toBeNull();
    await app.close();
  });
  it('TC-10: Random password reset invalidates sessions, challenges, and old token', async () => {
    const app = await buildServer();
    const prisma = getPrisma();
    const { headers } = await makeAdmin();
    const user = await makeUserForAdmin();

    await createSession(user.id);
    await prisma.adminTrustedDevice.create({
      data: {
        userId: user.id,
        tokenHash: hashToken('device-token-random'),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.totpChallenge.create({
      data: {
        userId: user.id,
        tokenHash: hashToken('challenge-token-random'),
        purpose: 'login',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    const oldToken = await issueAccessToken({
      sub: user.id,
      role: 'user',
      tokenVersion: user.tokenVersion,
    });
    const initialVersion = user.tokenVersion;

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${user.id}/send-random-password`,
      headers,
    });

    expect(res.statusCode).toBe(200);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.tokenVersion).toBe(initialVersion + 1);

    const sessions = await prisma.session.findMany({ where: { userId: user.id, revokedAt: null } });
    expect(sessions).toHaveLength(0);

    const devices = await prisma.adminTrustedDevice.findMany({ where: { userId: user.id, revokedAt: null } });
    expect(devices).toHaveLength(0);

    const challenges = await prisma.totpChallenge.findMany({ where: { userId: user.id } });
    expect(challenges).toHaveLength(0);

    const meRes = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${oldToken}` },
    });
    expect(meRes.statusCode).toBe(401);

    await app.close();
  });

  it('TC-11: Returns 502 and does not mutate user if email sending fails', async () => {
    const app = await buildServer();
    const prisma = getPrisma();
    const { headers } = await makeAdmin();
    const user = await makeUserForAdmin();

    const initialHash = user.passwordHash;
    const initialVersion = user.tokenVersion;

    const emailModule = await import('../../../src/services/auth/email.js');
    const spy = vi.spyOn(emailModule, 'sendAdminRandomPasswordEmail').mockRejectedValueOnce(new Error('SMTP connection refused'));

    try {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/admin/users/${user.id}/send-random-password`,
        headers,
      });

      expect(res.statusCode).toBe(502);
      expect(res.json().title).toContain('Failed to send temporary password email');

      const userAfter = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(userAfter.passwordHash).toBe(initialHash);
      expect(userAfter.tokenVersion).toBe(initialVersion);
    } finally {
      spy.mockRestore();
      await app.close();
    }
  });
});
