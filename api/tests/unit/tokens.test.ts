import { describe, expect, it, beforeAll } from 'vitest';
import { decodeJwt } from 'jose';
import {
  issueAccessToken,
  verifyAccessToken,
  issueRefreshToken,
} from '../../src/services/auth/tokens.js';
import { getConfig, resetConfigForTests } from '../../src/config.js';

beforeAll(() => resetConfigForTests());

describe('tokens', () => {
  it('issues a JWT string and verifies it', async () => {
    const token = await issueAccessToken({ sub: 'user-1', role: 'user' });
    expect(typeof token).toBe('string');
    const claims = await verifyAccessToken(token);
    expect(claims.sub).toBe('user-1');
    expect(claims.role).toBe('user');
  });

  it('rejects a tampered access token', async () => {
    const token = await issueAccessToken({ sub: 'user-1', role: 'user' });
    const tampered = token.slice(0, -2) + 'XX';
    await expect(verifyAccessToken(tampered)).rejects.toThrow();
  });

  it('signs the token with the configured access TTL', async () => {
    const token = await issueAccessToken({ sub: 'user-1', role: 'admin' });
    const decoded = decodeJwt(token);
    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
    expect((decoded.exp as number) - (decoded.iat as number)).toBe(
      getConfig().jwt.accessTtlSeconds,
    );
  });

  it('issueRefreshToken returns { token, hash, expiresAt }', () => {
    const r = issueRefreshToken();
    expect(r.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(r.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(r.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
