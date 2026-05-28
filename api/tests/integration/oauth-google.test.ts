import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

vi.mock('../../src/services/auth/google.js', () => ({
  verifyGoogleIdToken: vi.fn(),
}));

import { verifyGoogleIdToken } from '../../src/services/auth/google.js';

describe('POST /v1/auth/oauth/google', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates a user on first sign-in', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({
      sub: 'google-sub-1',
      email: 'gnew@example.com',
      emailVerified: true,
      givenName: 'Grace',
      familyName: 'Hopper',
    });
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/google',
      payload: { idToken: 'token' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.email).toBe('gnew@example.com');
    expect(body.user.firstName).toBe('Grace');
    expect(body.tokens.accessToken).toBeTruthy();

    const cred = await getPrisma().authCredential.findFirst({
      where: { type: 'google', providerUserId: 'google-sub-1' },
    });
    expect(cred).not.toBeNull();
    await app.close();
  });

  it('signs in an existing user without duplicating credentials', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({
      sub: 'google-sub-2',
      email: 'gex@example.com',
      emailVerified: true,
    });
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/google',
      payload: { idToken: 'first' },
    });
    const before = await getPrisma().authCredential.count({ where: { type: 'google' } });

    await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/google',
      payload: { idToken: 'second' },
    });
    const after = await getPrisma().authCredential.count({ where: { type: 'google' } });
    expect(after).toBe(before);
    await app.close();
  });

  it('links Google to an existing email-account on email match', async () => {
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'shared@example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'A',
        lastName: 'B',
      },
    });
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({
      sub: 'google-sub-3',
      email: 'shared@example.com',
      emailVerified: true,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/google',
      payload: { idToken: 't' },
    });
    expect(res.statusCode).toBe(200);
    const credCount = await getPrisma().authCredential.count({
      where: { user: { email: 'shared@example.com' } },
    });
    expect(credCount).toBe(2); // password + google
    await app.close();
  });

  it('rejects unverified emails', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({
      sub: 's',
      email: 'unv@example.com',
      emailVerified: false,
    });
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/google',
      payload: { idToken: 't' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('email_not_verified');
    await app.close();
  });
});
