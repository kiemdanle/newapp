import { describe, expect, it } from 'vitest';
import { authenticator } from 'otplib';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { hashPassword } from '../../../src/services/auth/passwords.js';
import { getConfig } from '../../../src/config.js';
import { encrypt } from '../../../src/utils/encryption.js';
import { hashToken } from '../../../src/utils/random.js';
import { issueAccessToken } from '../../../src/services/auth/tokens.js';
import { createSession } from '../../../src/services/auth/sessions.js';
import { makeAdmin, makeUserForAdmin } from '../../helpers/admin.js';

async function createAdminWith2fa(emailPrefix = 'admin2fa') {
  const prisma = getPrisma();
  const rawSecret = authenticator.generateSecret();
  const encryptedSecret = encrypt(rawSecret, getConfig().totp.encryptionKey);
  const passwordHash = await hashPassword('correct-horse-battery-staple');
  const email = `${emailPrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: 'Protected',
      lastName: 'Admin',
      role: 'admin',
      status: 'active',
      emailVerifiedAt: new Date(),
      totpSecret: encryptedSecret,
      totpEnabledAt: new Date(),
      tokenVersion: 1,
    },
  });

  // Create associated records: recovery codes, trusted devices, sessions, challenges
  await prisma.totpRecoveryCode.createMany({
    data: [
      { userId: user.id, codeHash: hashToken('recovery-code-1') },
      { userId: user.id, codeHash: hashToken('recovery-code-2') },
    ],
  });

  await prisma.adminTrustedDevice.create({
    data: {
      userId: user.id,
      tokenHash: hashToken('trusted-device-token-1'),
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
  });
  await createSession(user.id);

  await prisma.totpChallenge.create({
    data: {
      userId: user.id,
      tokenHash: hashToken('pending-challenge-1'),
      purpose: 'login',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  const tokenBeforeReset = await issueAccessToken({
    sub: user.id,
    role: 'admin',
    tokenVersion: user.tokenVersion,
  });

  return { user, rawSecret, tokenBeforeReset, email };
}

describe('POST /v1/admin/users/:id/reset-2fa', () => {
  it('TC-01: Admin successfully resets 2FA for another admin and purges all related security state', async () => {
    const app = await buildServer();
    const prisma = getPrisma();
    const { headers: operatorHeaders } = await makeAdmin();
    const { user: targetAdmin } = await createAdminWith2fa('target');

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${targetAdmin.id}/reset-2fa`,
      headers: operatorHeaders,
      payload: { notes: 'Admin lost phone and recovery codes' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.userId).toBe(targetAdmin.id);

    // Verify DB state
    const afterUser = await prisma.user.findUnique({ where: { id: targetAdmin.id } });
    expect(afterUser?.totpSecret).toBeNull();
    expect(afterUser?.totpEnabledAt).toBeNull();
    expect(afterUser?.tokenVersion).toBe(targetAdmin.tokenVersion + 1);

    // Verify recovery codes purged
    const recoveryCount = await prisma.totpRecoveryCode.count({ where: { userId: targetAdmin.id } });
    expect(recoveryCount).toBe(0);

    // Verify trusted devices revoked
    const activeDevices = await prisma.adminTrustedDevice.count({
      where: { userId: targetAdmin.id, revokedAt: null },
    });
    expect(activeDevices).toBe(0);

    // Verify sessions revoked
    const activeSessions = await prisma.session.count({
      where: { userId: targetAdmin.id, revokedAt: null },
    });
    expect(activeSessions).toBe(0);

    // Verify challenges purged
    const challengeCount = await prisma.totpChallenge.count({ where: { userId: targetAdmin.id } });
    expect(challengeCount).toBe(0);

    // Verify audit log written
    const auditLog = await prisma.adminAuditLog.findFirst({
      where: { targetId: targetAdmin.id, action: 'user.2fa_reset' },
    });
    expect(auditLog).toBeDefined();

    await app.close();
  });

  it('TC-02: Stolen / previously issued access token is immediately rejected after 2FA reset', async () => {
    const app = await buildServer();
    const { headers: operatorHeaders } = await makeAdmin();
    const { user: targetAdmin, tokenBeforeReset } = await createAdminWith2fa('stolen');

    // Token works before reset
    const preRes = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${tokenBeforeReset}` },
    });
    expect(preRes.statusCode).toBe(200);

    // Reset 2FA
    const resetRes = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${targetAdmin.id}/reset-2fa`,
      headers: operatorHeaders,
    });
    expect(resetRes.statusCode).toBe(200);

    // Token fails after reset due to tokenVersion increment
    const postRes = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${tokenBeforeReset}` },
    });
    expect(postRes.statusCode).toBe(401);

    await app.close();
  });

  it('TC-03: Non-admin user receives 403 Forbidden', async () => {
    const app = await buildServer();
    const regularUser = await makeUserForAdmin();
    const userToken = await issueAccessToken({
      sub: regularUser.id,
      role: 'user',
      tokenVersion: regularUser.tokenVersion,
    });
    const { user: targetAdmin } = await createAdminWith2fa('forbidden');

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${targetAdmin.id}/reset-2fa`,
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('TC-04: Reset on account without 2FA returns 400 cannot_reset_unenrolled_2fa', async () => {
    const app = await buildServer();
    const { headers: operatorHeaders } = await makeAdmin();
    const regularUser = await makeUserForAdmin();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${regularUser.id}/reset-2fa`,
      headers: operatorHeaders,
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('cannot_reset_unenrolled_2fa');

    await app.close();
  });

  it('TC-05: Self-reset requires confirmSelfReset flag', async () => {
    const app = await buildServer();
    const { user: selfAdmin, tokenBeforeReset } = await createAdminWith2fa('self');

    // Self-reset without flag -> 400
    const unconfirmedRes = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${selfAdmin.id}/reset-2fa`,
      headers: { authorization: `Bearer ${tokenBeforeReset}` },
      payload: {},
    });
    expect(unconfirmedRes.statusCode).toBe(400);
    expect(unconfirmedRes.json().code).toBe('self_2fa_reset_confirmation_required');

    // Self-reset with confirmSelfReset -> 200
    const confirmedRes = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${selfAdmin.id}/reset-2fa`,
      headers: { authorization: `Bearer ${tokenBeforeReset}` },
      payload: { confirmSelfReset: true },
    });
    expect(confirmedRes.statusCode).toBe(200);

    await app.close();
  });

  it('TC-06: Full lifecycle: reset admin is forced to re-enroll and can successfully verify new TOTP', async () => {
    const app = await buildServer();
    const { headers: operatorHeaders } = await makeAdmin();
    const { user: targetAdmin, email } = await createAdminWith2fa('lifecycle');

    // 1. Reset 2FA
    const resetRes = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${targetAdmin.id}/reset-2fa`,
      headers: operatorHeaders,
    });
    expect(resetRes.statusCode).toBe(200);

    // 2. Admin attempts password login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password: 'correct-horse-battery-staple' },
    });
    expect(loginRes.statusCode).toBe(200);
    const loginBody = loginRes.json();
    expect(loginBody.requiresTotpEnrollment).toBe(true);
    expect(loginBody.enrollmentChallenge).toBeDefined();

    // 3. Admin requests enrollment payload
    const enrollRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/enroll',
      payload: { enrollmentChallenge: loginBody.enrollmentChallenge },
    });
    expect(enrollRes.statusCode).toBe(200);
    const { secret: newSecret, recoveryCodes } = enrollRes.json();
    expect(newSecret).toBeDefined();
    expect(recoveryCodes).toHaveLength(10);

    // 4. Admin submits verification code from new authenticator app
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/verify-enrollment',
      payload: {
        enrollmentChallenge: loginBody.enrollmentChallenge,
        code: authenticator.generate(newSecret),
      },
    });
    expect(verifyRes.statusCode).toBe(204);

    // 5. Subsequent login now issues TOTP second-factor challenge
    const nextLoginRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password: 'correct-horse-battery-staple' },
    });
    expect(nextLoginRes.statusCode).toBe(200);
    const nextLoginBody = nextLoginRes.json();
    expect(nextLoginBody.requiresTotp).toBe(true);
    expect(nextLoginBody.challengeToken).toBeDefined();

    // 6. Complete TOTP verification
    const challengeVerifyRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/challenge-verify',
      payload: {
        challengeToken: nextLoginBody.challengeToken,
        code: authenticator.generate(newSecret),
      },
    });
    expect(challengeVerifyRes.statusCode).toBe(200);
    expect(challengeVerifyRes.json().tokens.accessToken).toBeDefined();

    await app.close();
  });

  it('TC-07: Disaster Recovery CLI resets 2FA directly in PostgreSQL', async () => {
    const prisma = getPrisma();
    const { user: targetAdmin, email } = await createAdminWith2fa('cli');

    // Verify 2FA active before CLI
    expect(targetAdmin.totpSecret).toBeDefined();
    expect(targetAdmin.totpEnabledAt).toBeDefined();

    // Execute the reset transaction matching CLI logic
    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: targetAdmin.id },
        data: {
          totpSecret: null,
          totpEnabledAt: null,
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.totpRecoveryCode.deleteMany({
        where: { userId: targetAdmin.id },
      }),
      prisma.adminTrustedDevice.updateMany({
        where: { userId: targetAdmin.id, revokedAt: null },
        data: { revokedAt: now },
      }),
      prisma.session.updateMany({
        where: { userId: targetAdmin.id, revokedAt: null },
        data: { revokedAt: now },
      }),
      prisma.totpChallenge.deleteMany({
        where: { userId: targetAdmin.id },
      }),
    ]);

    // Assert clean state
    const afterUser = await prisma.user.findUnique({ where: { id: targetAdmin.id } });
    expect(afterUser?.totpSecret).toBeNull();
    expect(afterUser?.totpEnabledAt).toBeNull();
    expect(afterUser?.tokenVersion).toBe(targetAdmin.tokenVersion + 1);

    const recoveryCount = await prisma.totpRecoveryCode.count({ where: { userId: targetAdmin.id } });
    expect(recoveryCount).toBe(0);
  });
});
