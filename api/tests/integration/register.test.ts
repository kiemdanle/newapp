import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

describe('POST /v1/auth/register', () => {
  it('creates a user, returns auth result, sends verification email', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'NewUser@Example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'Ada',
        lastName: 'Lovelace',
      },
      headers: { 'x-forwarded-for': '8.8.8.8' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.email).toBe('newuser@example.com');
    expect(body.user.emailVerified).toBe(false);
    expect(body.tokens.accessToken).toBeTruthy();
    expect(body.tokens.refreshToken).toBeTruthy();

    const stored = await getPrisma().user.findUnique({
      where: { email: 'newuser@example.com' },
    });
    expect(stored?.passwordHash).toMatch(/^\$argon2id/);
    const tokens = await getPrisma().emailToken.findMany({ where: { userId: stored!.id } });
    expect(tokens).toHaveLength(1);
    await app.close();
  });

  it('rejects a duplicate email with 409', async () => {
    const app = await buildServer();
    const payload = {
      email: 'dupe@example.com',
      password: 'correct-horse-battery-staple',
      firstName: 'A',
      lastName: 'B',
    };
    await app.inject({ method: 'POST', url: '/v1/auth/register', payload });
    const res = await app.inject({ method: 'POST', url: '/v1/auth/register', payload });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('email_already_registered');
    await app.close();
  });

  it('rejects bad input with 400', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'nope', password: 'short', firstName: '', lastName: '' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('validation_error');
    await app.close();
  });
});
