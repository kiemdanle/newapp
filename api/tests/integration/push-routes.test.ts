import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

const DEVICE_TOKEN = 'fcm-device-token-abcdefghijklmnopqrstuvwxyz-1234567890';

async function authed() {
  const user = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: user.id, role: user.role, tokenVersion: 0 });
  return { user, headers: { authorization: `Bearer ${token}` } };
}

describe.sequential('push token routes', () => {
  it('upserts a device token', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const token = `${DEVICE_TOKEN}-1`;
    const res = await app.inject({
      method: 'POST',
      url: '/v1/me/push-token',
      headers,
      payload: {
        deviceToken: token,
        platform: 'ios',
        deviceInfo: { model: 'iPhone15' },
      },
    });
    expect(res.statusCode).toBe(201);
    const rows = await getPrisma().pushToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.platform).toBe('ios');
    expect(rows[0]!.deviceToken).toBe(token);
    await app.close();
  });

  it('upsert is idempotent on token value for its owner', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const token = `${DEVICE_TOKEN}-2`;
    const payload = { deviceToken: token, platform: 'android' };
    await app.inject({ method: 'POST', url: '/v1/me/push-token', headers, payload });
    await app.inject({ method: 'POST', url: '/v1/me/push-token', headers, payload });
    const rows = await getPrisma().pushToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    await app.close();
  });

  it('reassigns a device token when registered by another user on a shared device', async () => {
    const app = await buildServer();
    const first = await authed();
    const second = await authed();
    const token = `${DEVICE_TOKEN}-3`;
    const payload = { deviceToken: token, platform: 'android' };

    expect((await app.inject({ method: 'POST', url: '/v1/me/push-token', headers: first.headers, payload })).statusCode).toBe(201);
    const res = await app.inject({ method: 'POST', url: '/v1/me/push-token', headers: second.headers, payload });

    expect(res.statusCode).toBe(201);
    const row = await getPrisma().pushToken.findUnique({ where: { deviceToken: token } });
    expect(row?.userId).toBe(second.user.id);
    expect(row?.revokedAt).toBeNull();
    await app.close();
  });

  it('revokes a token by id', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const created = await app.inject({
      method: 'POST',
      url: '/v1/me/push-token',
      headers,
      payload: { deviceToken: DEVICE_TOKEN, platform: 'android' },
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

  it('revokes a token by device token value via /revoke-by-token', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    await app.inject({
      method: 'POST',
      url: '/v1/me/push-token',
      headers,
      payload: { deviceToken: DEVICE_TOKEN, platform: 'android' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/me/push-token/revoke-by-token',
      headers,
      payload: { deviceToken: DEVICE_TOKEN },
    });
    expect(res.statusCode).toBe(204);
    const row = await getPrisma().pushToken.findUnique({ where: { deviceToken: DEVICE_TOKEN } });
    expect(row?.revokedAt).not.toBeNull();
    await app.close();
  });

  it('rejects an invalid device token', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/me/push-token',
      headers,
      payload: { deviceToken: 'too-short', platform: 'ios' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('reassigns token ownership during concurrent unique-token race', async () => {
    const app = await buildServer();
    const first = await authed();
    const second = await authed();
    const token = `${DEVICE_TOKEN}-race`;

    await getPrisma().pushToken.create({
      data: {
        userId: first.user.id,
        deviceToken: token,
        platform: 'android',
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/me/push-token',
      headers: second.headers,
      payload: { deviceToken: token, platform: 'android' },
    });

    expect(res.statusCode).toBe(201);
    const row = await getPrisma().pushToken.findUnique({ where: { deviceToken: token } });
    expect(row?.userId).toBe(second.user.id);
    await app.close();
  });
});
