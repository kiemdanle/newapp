import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function authed() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

describe('push token routes', () => {
  it('upserts a push token', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/me/push-token',
      headers,
      payload: {
        expoPushToken: 'ExponentPushToken[xxxxx]',
        platform: 'ios',
        deviceInfo: { model: 'iPhone15' },
      },
    });
    expect(res.statusCode).toBe(201);
    const rows = await getPrisma().pushToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.platform).toBe('ios');
    await app.close();
  });

  it('upsert is idempotent on token value', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const payload = { expoPushToken: 'ExponentPushToken[same]', platform: 'android' };
    await app.inject({ method: 'POST', url: '/v1/me/push-token', headers, payload });
    await app.inject({ method: 'POST', url: '/v1/me/push-token', headers, payload });
    const rows = await getPrisma().pushToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    await app.close();
  });

  it('revokes a token by id', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const created = await app.inject({
      method: 'POST',
      url: '/v1/me/push-token',
      headers,
      payload: { expoPushToken: 'ExponentPushToken[revoke]', platform: 'android' },
    });
    const id = created.json().id;
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/me/push-token/${id}`,
      headers,
    });
    expect(res.statusCode).toBe(204);
    const row = await getPrisma().pushToken.findUnique({ where: { id } });
    expect(row?.revokedAt).not.toBeNull();
    await app.close();
  });

  it('rejects invalid token format', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/me/push-token',
      headers,
      payload: { expoPushToken: 'not-a-token', platform: 'ios' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
