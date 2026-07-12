import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function authed() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role, tokenVersion: 0 });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

describe('GET /v1/me/usage', () => {
  it('returns zero counts for a new user', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const res = await app.inject({ method: 'GET', url: '/v1/me/usage', headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.itemCount).toBe(0);
    expect(body.itemLimit).toBe(50);
    expect(body.readOnly).toBe(false);
    await app.close();
  });

  it('counts only active records', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const prisma = getPrisma();
    await prisma.record.create({
      data: {
        userId: user.id, clientId: randomUUID(), customName: 'Active',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs',
        status: 'active', notifyAt: [],
      },
    });
    await prisma.record.create({
      data: {
        userId: user.id, clientId: randomUUID(), customName: 'Consumed',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs',
        status: 'consumed', notifyAt: [],
      },
    });
    const res = await app.inject({ method: 'GET', url: '/v1/me/usage', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().itemCount).toBe(1);
    expect(res.json().readOnly).toBe(false);
    await app.close();
  });

  it('readOnly true when at cap', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const prisma = getPrisma();
    for (let i = 0; i < 50; i++) {
      await prisma.record.create({
        data: {
          userId: user.id, clientId: randomUUID(), customName: `R${i}`,
          expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs',
          status: 'active', notifyAt: [],
        },
      });
    }
    const res = await app.inject({ method: 'GET', url: '/v1/me/usage', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().itemCount).toBe(50);
    expect(res.json().readOnly).toBe(true);
    await app.close();
  });

  it('requires auth', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/v1/me/usage' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
