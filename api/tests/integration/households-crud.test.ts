import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';

async function headersFor(userId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: userId, role: 'user', tokenVersion: 0 })}`,
    'idempotency-key': randomUUID(),
  };
}

describe('households CRUD', () => {
  it('creator becomes owner; appears in GET /mine; owner can rename', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const h = await headersFor(user.id);

    const created = await app.inject({
      method: 'POST', url: '/v1/households', headers: h, payload: { name: 'Flat 3B' },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json();
    expect(body.id).toBeTruthy();
    expect(body.ownerUserId).toBe(user.id);
    expect(body.myRole).toBe('owner');

    const mine = await app.inject({ method: 'GET', url: '/v1/households/mine', headers: h });
    expect(mine.json().items.map((hh: { id: string }) => hh.id)).toContain(body.id);

    const renamed = await app.inject({
      method: 'PATCH', url: `/v1/households/${body.id}`,
      headers: { ...h, 'idempotency-key': randomUUID() },
      payload: { name: 'Flat 3C' },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().name).toBe('Flat 3C');
    await app.close();
  });

  it('non-member gets 403 on GET detail', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const h = await headersFor(owner.id);
    const created = await app.inject({
      method: 'POST', url: '/v1/households', headers: h, payload: { name: 'Private' },
    });
    const id = created.json().id;

    const stranger = await makeUser({ emailVerified: true });
    const res = await app.inject({ method: 'GET', url: `/v1/households/${id}`, headers: await headersFor(stranger.id) });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('household_not_member');
    await app.close();
  });

  it('non-owner gets 403 on rename', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const id = (await app.inject({
      method: 'POST', url: '/v1/households', headers: await headersFor(owner.id), payload: { name: 'Shared' },
    })).json().id;

    const stranger = await makeUser({ emailVerified: true });
    const res = await app.inject({
      method: 'PATCH', url: `/v1/households/${id}`,
      headers: { ...await headersFor(stranger.id), 'idempotency-key': randomUUID() },
      payload: { name: 'Nope' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('GET /mine empty when user has no households', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const res = await app.inject({ method: 'GET', url: '/v1/households/mine', headers: await headersFor(user.id) });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toEqual([]);
    await app.close();
  });
});
