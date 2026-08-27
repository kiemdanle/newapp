import { describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authenticator } from 'otplib';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';
import { hashPassword } from '../../src/services/auth/passwords.js';

async function makeAdmin(email = 'admin-td@example.com') {
  const hash = await hashPassword('admin-password-1234');
  return getPrisma().user.create({
    data: {
      email,
      passwordHash: hash,
      firstName: 'Admin',
      lastName: 'Trusted',
      role: 'admin',
      emailVerifiedAt: new Date(),
    },
  });
}

/** Password-login a fresh admin and return the forced-enrollment challenge. */
async function loginForEnrollment(app: FastifyInstance, email = 'admin-td@example.com') {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password: 'admin-password-1234' },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.requiresTotpEnrollment).toBe(true);
  return body.enrollmentChallenge as string;
}

/** Full enrollment: returns the raw secret. */
async function enroll(app: FastifyInstance, email = 'admin-td@example.com') {
  const enrollmentChallenge = await loginForEnrollment(app, email);
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/totp/enroll',
    payload: { enrollmentChallenge },
  });
  expect(res.statusCode).toBe(200);
  const { secret } = res.json();
  const verify = await app.inject({
    method: 'POST',
    url: '/v1/auth/totp/verify-enrollment',
    payload: { enrollmentChallenge, code: authenticator.generate(secret) },
  });
  expect(verify.statusCode).toBe(204);
  return secret as string;
}

describe('Admin Trusted Devices', () => {
  it('enrolled admin without device token receives TOTP challenge, then can trust device on verify', async () => {
    const app = await buildServer();
    const admin = await makeAdmin('admin-trust-1@example.com');
    await getPrisma().authCredential.create({
      data: { userId: admin.id, type: 'password' },
    });
    const secret = await enroll(app, 'admin-trust-1@example.com');

    // Step 1: Login without trusted device token
    const login1 = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-trust-1@example.com', password: 'admin-password-1234' },
    });
    expect(login1.statusCode).toBe(200);
    const body1 = login1.json();
    expect(body1.requiresTotp).toBe(true);
    expect(body1.tokens).toBeUndefined();
    const challengeToken = body1.challengeToken;

    // Step 2: Verify TOTP with trustDevice: true
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/challenge-verify',
      payload: {
        challengeToken,
        code: authenticator.generate(secret),
        trustDevice: true,
      },
    });
    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = verifyRes.json();
    expect(verifyBody.tokens.accessToken).toBeTruthy();
    expect(verifyBody.trustedDeviceToken).toBeTruthy();
    const trustedToken = verifyBody.trustedDeviceToken as string;

    // Step 3: Subsequent login with trustedDeviceToken bypasses TOTP!
    const login2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'admin-trust-1@example.com',
        password: 'admin-password-1234',
        trustedDeviceToken: trustedToken,
      },
    });
    expect(login2.statusCode).toBe(200);
    const login2Body = login2.json();
    expect(login2Body.requiresTotp).toBeUndefined();
    expect(login2Body.tokens?.accessToken).toBeTruthy();

    await app.close();
  });

  it('rejects trusted device tokens belonging to another user', async () => {
    const app = await buildServer();
    const admin1 = await makeAdmin('admin-iso-1@example.com');
    const admin2 = await makeAdmin('admin-iso-2@example.com');
    await getPrisma().authCredential.createMany({
      data: [
        { userId: admin1.id, type: 'password' },
        { userId: admin2.id, type: 'password' },
      ],
    });
    const secret1 = await enroll(app, 'admin-iso-1@example.com');
    await enroll(app, 'admin-iso-2@example.com');

    // Admin 1 gets a trusted device token
    const l1 = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-iso-1@example.com', password: 'admin-password-1234' },
    });
    const v1 = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/challenge-verify',
      payload: {
        challengeToken: l1.json().challengeToken,
        code: authenticator.generate(secret1),
        trustDevice: true,
      },
    });
    const admin1Token = v1.json().trustedDeviceToken as string;

    // Admin 2 tries to log in using Admin 1's device token -> rejected and requires TOTP!
    const l2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'admin-iso-2@example.com',
        password: 'admin-password-1234',
        trustedDeviceToken: admin1Token,
      },
    });
    expect(l2.statusCode).toBe(200);
    expect(l2.json().requiresTotp).toBe(true);
    expect(l2.json().tokens).toBeUndefined();

    await app.close();
  });

  it('allows listing and revoking trusted devices via admin API', async () => {
    const app = await buildServer();
    const admin = await makeAdmin('admin-manage@example.com');
    await getPrisma().authCredential.create({
      data: { userId: admin.id, type: 'password' },
    });
    const secret = await enroll(app, 'admin-manage@example.com');

    const l = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-manage@example.com', password: 'admin-password-1234' },
    });
    const v = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/challenge-verify',
      payload: {
        challengeToken: l.json().challengeToken,
        code: authenticator.generate(secret),
        trustDevice: true,
      },
    });
    const { accessToken } = v.json().tokens;
    const deviceToken = v.json().trustedDeviceToken as string;

    // List devices
    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/trusted-devices',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const { devices } = listRes.json();
    expect(devices.length).toBeGreaterThanOrEqual(1);
    const deviceId = devices[0].id;

    // Delete device
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/trusted-devices/${deviceId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().ok).toBe(true);

    // Subsequent login with revoked device token requires TOTP again
    const lAfterRevoke = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'admin-manage@example.com',
        password: 'admin-password-1234',
        trustedDeviceToken: deviceToken,
      },
    });
    expect(lAfterRevoke.statusCode).toBe(200);
    expect(lAfterRevoke.json().requiresTotp).toBe(true);

    await app.close();
  });
});
