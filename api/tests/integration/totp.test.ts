import { describe, expect, it } from 'vitest';
import { authenticator } from 'otplib';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';
import { hashPassword } from '../../src/services/auth/passwords.js';

async function makeAdmin() {
  const hash = await hashPassword('admin-password-1234');
  return getPrisma().user.create({
    data: {
      email: 'admin@example.com',
      passwordHash: hash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      emailVerifiedAt: new Date(),
    },
  });
}

/** Password-login a fresh admin and return the forced-enrollment challenge. */
async function loginForEnrollment(app: Awaited<ReturnType<typeof buildServer>>) {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: 'admin@example.com', password: 'admin-password-1234' },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.requiresTotpEnrollment).toBe(true);
  expect(body.tokens).toBeUndefined();
  return body.enrollmentChallenge as string;
}

/** Full enrollment: returns the raw secret + recovery codes for later assertions. */
async function enroll(app: Awaited<ReturnType<typeof buildServer>>) {
  const enrollmentChallenge = await loginForEnrollment(app);
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/totp/enroll',
    payload: { enrollmentChallenge },
  });
  expect(res.statusCode).toBe(200);
  const { qrCodeDataUrl, secret, recoveryCodes } = res.json();
  expect(qrCodeDataUrl).toContain('data:image/png');
  expect(secret).toBeTruthy();
  expect(recoveryCodes).toHaveLength(10);
  const verify = await app.inject({
    method: 'POST',
    url: '/v1/auth/totp/verify-enrollment',
    payload: { enrollmentChallenge, code: authenticator.generate(secret) },
  });
  expect(verify.statusCode).toBe(204);
  return { secret: secret as string, recoveryCodes: recoveryCodes as string[] };
}

describe('TOTP', () => {
  it('enroll rejects a missing/invalid enrollment challenge', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/enroll',
      payload: { enrollmentChallenge: 'not-a-real-challenge' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('repeated enroll returns the same secret, and its code verifies', async () => {
    const app = await buildServer();
    const admin = await makeAdmin();
    await getPrisma().authCredential.create({
      data: { userId: admin.id, type: 'password' },
    });
    const enrollmentChallenge = await loginForEnrollment(app);

    const first = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/enroll',
      payload: { enrollmentChallenge },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/enroll',
      payload: { enrollmentChallenge },
    });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const s1 = first.json().secret as string;
    const s2 = second.json().secret as string;
    expect(s2).toBe(s1);

    // The code derived from the (stable) displayed secret must verify.
    const verify = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/verify-enrollment',
      payload: { enrollmentChallenge, code: authenticator.generate(s1) },
    });
    expect(verify.statusCode).toBe(204);
    await app.close();
  });

  it('admin enroll → verify-enrollment persists hashed recovery codes', async () => {
    const app = await buildServer();
    const admin = await makeAdmin();
    await getPrisma().authCredential.create({
      data: { userId: admin.id, type: 'password' },
    });

    const { recoveryCodes } = await enroll(app);

    const stored = await getPrisma().totpRecoveryCode.findMany({
      where: { userId: admin.id },
    });
    expect(stored).toHaveLength(10);
    for (const row of stored) {
      expect(recoveryCodes).not.toContain(row.codeHash);
      expect(row.usedAt).toBeNull();
    }
    const after = await getPrisma().user.findUnique({ where: { id: admin.id } });
    expect(after?.totpEnabledAt).not.toBeNull();
    await app.close();
  });

  it('enabled admin: login → TOTP challenge-verify grants a session', async () => {
    const app = await buildServer();
    const admin = await makeAdmin();
    await getPrisma().authCredential.create({
      data: { userId: admin.id, type: 'password' },
    });
    const { secret } = await enroll(app);

    const login2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin@example.com', password: 'admin-password-1234' },
    });
    const challenge = login2.json();
    expect(challenge.requiresTotp).toBe(true);
    expect(challenge.tokens).toBeUndefined();
    const challengeToken = challenge.challengeToken;

    const wrong = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/challenge-verify',
      payload: { challengeToken, code: '000000' },
    });
    expect(wrong.statusCode).toBe(401);

    const right = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/challenge-verify',
      payload: { challengeToken, code: authenticator.generate(secret) },
    });
    expect(right.statusCode).toBe(200);
    expect(right.json().tokens.accessToken).toBeTruthy();
    await app.close();
  });

  it('challenge token is single-use', async () => {
    const app = await buildServer();
    const admin = await makeAdmin();
    await getPrisma().authCredential.create({
      data: { userId: admin.id, type: 'password' },
    });
    const { secret } = await enroll(app);

    const login2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin@example.com', password: 'admin-password-1234' },
    });
    const ct = login2.json().challengeToken;
    await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/challenge-verify',
      payload: { challengeToken: ct, code: authenticator.generate(secret) },
    });
    const replay = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/challenge-verify',
      payload: { challengeToken: ct, code: authenticator.generate(secret) },
    });
    expect(replay.statusCode).toBe(401);
    await app.close();
  });

  it('a recovery code can be redeemed once to grant a session, then is rejected on reuse', async () => {
    const app = await buildServer();
    const admin = await makeAdmin();
    await getPrisma().authCredential.create({
      data: { userId: admin.id, type: 'password' },
    });
    const { recoveryCodes } = await enroll(app);
    const code = recoveryCodes[0]!;

    const login2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin@example.com', password: 'admin-password-1234' },
    });
    const ct = login2.json().challengeToken;

    const redeem = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/recovery-verify',
      payload: { challengeToken: ct, recoveryCode: code },
    });
    expect(redeem.statusCode).toBe(200);
    expect(redeem.json().tokens.accessToken).toBeTruthy();

    const login3 = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin@example.com', password: 'admin-password-1234' },
    });
    const ct3 = login3.json().challengeToken;
    const reuse = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/recovery-verify',
      payload: { challengeToken: ct3, recoveryCode: code },
    });
    expect(reuse.statusCode).toBe(401);
    await app.close();
  });
});
