import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

/**
 * Register, then mark the email verified — sign-in now requires a verified email,
 * so the standard "happy path" fixture has to clear that gate first.
 */
async function registerVerified(
  app: Awaited<ReturnType<typeof buildServer>>,
  email: string,
  password = 'correct-horse-battery-staple',
) {
  await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password, firstName: 'A', lastName: 'B' },
  });
  await getPrisma().user.update({
    where: { email },
    data: { emailVerifiedAt: new Date() },
  });
}

describe('POST /v1/auth/login', () => {
  it('returns tokens for correct password (verified user)', async () => {
    const app = await buildServer();
    await registerVerified(app, 'login@example.com');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'login@example.com', password: 'correct-horse-battery-staple' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().tokens.accessToken).toBeTruthy();
    await app.close();
  });

  it('rejects sign-in for an unverified email with 403 email_not_verified', async () => {
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'unverified@example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'A',
        lastName: 'B',
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'unverified@example.com', password: 'correct-horse-battery-staple' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('email_not_verified');
    await app.close();
  });

  it('rejects wrong password with 401 invalid_credentials', async () => {
    const app = await buildServer();
    await registerVerified(app, 'login2@example.com');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'login2@example.com', password: 'wrong-horse-battery-staple' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('invalid_credentials');
    await app.close();
  });

  it('rejects unknown email with 401 invalid_credentials (no leak)', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'nobody@example.com', password: 'correct-horse-battery-staple' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('invalid_credentials');
    await app.close();
  });

  it('returns a TOTP challenge for an admin who already enabled TOTP', async () => {
    const app = await buildServer();
    const { hashPassword } = await import('../../src/services/auth/passwords.js');
    const hash = await hashPassword('admin-password-1234');
    const admin = await getPrisma().user.create({
      data: {
        email: 'admin@example.com',
        passwordHash: hash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        emailVerifiedAt: new Date(),
        totpSecret: 'enc.cipher.payload',
        totpEnabledAt: new Date(),
      },
    });
    await getPrisma().authCredential.create({
      data: { userId: admin.id, type: 'password' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin@example.com', password: 'admin-password-1234' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.requiresTotp).toBe(true);
    expect(body.challengeToken).toBeTruthy();
    expect(body.tokens).toBeUndefined();
    await app.close();
  });

  it('forces TOTP enrollment for an admin who has not set up TOTP yet (no full session)', async () => {
    const app = await buildServer();
    const { hashPassword } = await import('../../src/services/auth/passwords.js');
    const hash = await hashPassword('admin-password-1234');
    const admin = await getPrisma().user.create({
      data: {
        email: 'newadmin@example.com',
        passwordHash: hash,
        firstName: 'New',
        lastName: 'Admin',
        role: 'admin',
        emailVerifiedAt: new Date(),
      },
    });
    await getPrisma().authCredential.create({
      data: { userId: admin.id, type: 'password' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'newadmin@example.com', password: 'admin-password-1234' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.requiresTotpEnrollment).toBe(true);
    expect(body.enrollmentChallenge).toBeTruthy();
    expect(body.tokens).toBeUndefined();
    await app.close();
  });
});
