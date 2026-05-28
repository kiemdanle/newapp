import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function authed() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

describe('POST /v1/records/sync', () => {
  it('upserts batched records and returns server changes since `since`', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    // server-side record the client doesn't know about
    await getPrisma().record.create({
      data: {
        userId: user.id,
        clientId: randomUUID(),
        customName: 'ServerOnly',
        expiryDate: new Date('2099-12-31'),
        quantity: 1,
        unit: 'pcs',
        notifyAt: [],
      },
    });

    const clientId = randomUUID();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/records/sync',
      headers,
      payload: {
        since: null,
        upserts: [
          {
            clientId,
            customName: 'FromMobile',
            expiryDate: '2099-12-31',
            quantity: 2,
            unit: 'pcs',
            updatedAt: new Date().toISOString(),
          },
        ],
        deletes: [],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.serverTime).toBeTruthy();
    const names = body.changes.map((r: { customName: string }) => r.customName);
    expect(names).toContain('ServerOnly');
    expect(names).toContain('FromMobile');
    await app.close();
  });

  it('last-write-wins on client_id collision (newer updatedAt overwrites)', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const clientId = randomUUID();
    await getPrisma().record.create({
      data: {
        userId: user.id,
        clientId,
        customName: 'Old',
        expiryDate: new Date('2099-12-31'),
        quantity: 1,
        unit: 'pcs',
        notifyAt: [],
        updatedAt: new Date('2020-01-01'),
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/records/sync',
      headers,
      payload: {
        since: null,
        upserts: [
          {
            clientId,
            customName: 'New',
            expiryDate: '2099-12-31',
            quantity: 1,
            unit: 'pcs',
            updatedAt: new Date().toISOString(),
          },
        ],
        deletes: [],
      },
    });
    expect(res.statusCode).toBe(200);
    const row = await getPrisma().record.findUnique({ where: { clientId } });
    expect(row?.customName).toBe('New');
    await app.close();
  });

  it('older client updatedAt is ignored', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const clientId = randomUUID();
    await getPrisma().record.create({
      data: {
        userId: user.id,
        clientId,
        customName: 'Server',
        expiryDate: new Date('2099-12-31'),
        quantity: 1,
        unit: 'pcs',
        notifyAt: [],
      },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/records/sync',
      headers,
      payload: {
        since: null,
        upserts: [
          {
            clientId,
            customName: 'Stale',
            expiryDate: '2099-12-31',
            quantity: 1,
            unit: 'pcs',
            updatedAt: new Date('2020-01-01').toISOString(),
          },
        ],
        deletes: [],
      },
    });
    const row = await getPrisma().record.findUnique({ where: { clientId } });
    expect(row?.customName).toBe('Server');
    await app.close();
  });

  it('honors deletes array', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const row = await getPrisma().record.create({
      data: {
        userId: user.id,
        clientId: randomUUID(),
        customName: 'X',
        expiryDate: new Date('2099-12-31'),
        quantity: 1,
        unit: 'pcs',
        notifyAt: [],
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/records/sync',
      headers,
      payload: { since: null, upserts: [], deletes: [row.id] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().deletedIds).toContain(row.id);
    expect(await getPrisma().record.findUnique({ where: { id: row.id } })).toBeNull();
    await app.close();
  });
});
