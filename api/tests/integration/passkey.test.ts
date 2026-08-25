import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

describe('passkey routes', () => {
  it('register/options requires auth', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkey/register/options',
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('register/options returns a challenge for an authenticated user', async () => {
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'p@example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'A',
        lastName: 'B',
      },
    });
    await getPrisma().user.update({
      where: { email: 'p@example.com' },
      data: { emailVerifiedAt: new Date() },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'p@example.com', password: 'correct-horse-battery-staple' },
    });
    const tok = login.json().tokens.accessToken;
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkey/register/options',
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.challenge).toBeTruthy();
    expect(body.rp.id).toBe('localhost');
    expect(body.authenticatorSelection.residentKey).toBe('required');
    expect(body.authenticatorSelection.requireResidentKey).toBe(true);
    expect(body.authenticatorSelection.authenticatorAttachment).toBe('platform');
    await app.close();
  });

  it('login/options with empty body returns discoverable options with no allowCredentials', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkey/login/options',
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.challenge).toBeTruthy();
    expect(body.rpId).toBe('localhost');
    expect(body.allowCredentials).toBeUndefined();
    await app.close();
  });

  it('login/options with email returns credentials when user has passkey', async () => {
    const app = await buildServer();
    const prisma = getPrisma();
    const user = await prisma.user.create({
      data: {
        email: 'passkey-user@example.com',
        emailVerifiedAt: new Date(),
        passwordHash: 'dummy-hash-1234567890',
        firstName: 'Passkey',
        lastName: 'User',
        status: 'active',
      },
    });
    await prisma.authCredential.create({
      data: {
        userId: user.id,
        type: 'passkey',
        providerUserId: 'test-cred-id-base64url',
        publicKey: Buffer.from('dummy-public-key'),
        counter: 0n,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkey/login/options',
      payload: { email: 'passkey-user@example.com' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.challenge).toBeTruthy();
    expect(body.allowCredentials).toEqual([{ id: 'test-cred-id-base64url', type: 'public-key' }]);
    await app.close();
  });

  it('login/options for an unknown email returns generic options (no leak)', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkey/login/options',
      payload: { email: 'nobody@example.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().challenge).toBeTruthy();
    expect(res.json().allowCredentials).toBeUndefined();
    await app.close();
  });

  it('login/verify rejects missing or invalid credential ID', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkey/login/verify',
      payload: { assertionResponse: {} },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().title).toMatch(/missing or invalid credential id/i);
    await app.close();
  });
});
