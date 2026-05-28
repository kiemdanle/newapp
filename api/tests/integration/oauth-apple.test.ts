import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

vi.mock('../../src/services/auth/apple.js', () => ({
  verifyAppleIdentityToken: vi.fn(),
}));

import { verifyAppleIdentityToken } from '../../src/services/auth/apple.js';

describe('POST /v1/auth/oauth/apple', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates a user on first sign-in (with name from payload)', async () => {
    vi.mocked(verifyAppleIdentityToken).mockResolvedValue({
      sub: 'apple-sub-1',
      email: 'a@example.com',
      emailVerified: true,
      isPrivateEmail: false,
    });
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/apple',
      payload: { identityToken: 't', firstName: 'Anita', lastName: 'Borg' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.firstName).toBe('Anita');
    const cred = await getPrisma().authCredential.findFirst({
      where: { type: 'apple', providerUserId: 'apple-sub-1' },
    });
    expect(cred).not.toBeNull();
    await app.close();
  });

  it('handles second-time sign-in when Apple omits the name fields', async () => {
    vi.mocked(verifyAppleIdentityToken).mockResolvedValue({
      sub: 'apple-sub-2',
      email: 'a2@example.com',
      emailVerified: true,
      isPrivateEmail: false,
    });
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/apple',
      payload: { identityToken: 'first', firstName: 'Ada', lastName: 'L' },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/apple',
      payload: { identityToken: 'second' },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().user.firstName).toBe('Ada');
    await app.close();
  });

  it('handles sub-only token (no email) gracefully', async () => {
    vi.mocked(verifyAppleIdentityToken).mockResolvedValue({
      sub: 'apple-sub-3',
      emailVerified: false,
      isPrivateEmail: false,
    });
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/apple',
      payload: { identityToken: 't', firstName: 'X', lastName: 'Y' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('email_not_verified');
    await app.close();
  });
});
