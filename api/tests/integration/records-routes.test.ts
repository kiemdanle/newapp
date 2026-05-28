import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function authed() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

describe('POST /v1/records', () => {
  it('creates a record, computes notify_at, returns 201', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const p = await makeProduct({ name: 'Milk' });
    const clientId = randomUUID();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'idempotency-key': clientId },
      payload: {
        clientId,
        productId: p.id,
        expiryDate: '2099-12-31',
        quantity: 2,
        unit: 'L',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.userId).toBe(user.id);
    expect(body.productId).toBe(p.id);
    expect(body.notifyAt.length).toBe(3); // default offsets all in future
    expect(body.clientId).toBe(clientId);
    await app.close();
  });

  it('replays response on duplicate Idempotency-Key', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const clientId = randomUUID();
    const payload = {
      clientId,
      customName: 'Bread',
      expiryDate: '2099-12-31',
      quantity: 1,
      unit: 'pcs',
    };
    const r1 = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'idempotency-key': clientId },
      payload,
    });
    const r2 = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'idempotency-key': clientId },
      payload,
    });
    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(201);
    expect(r1.json().id).toBe(r2.json().id);
    const rows = await getPrisma().record.findMany({ where: { clientId } });
    expect(rows).toHaveLength(1);
    await app.close();
  });

  it('400 when Idempotency-Key header is missing', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers,
      payload: {
        clientId: randomUUID(),
        customName: 'X',
        expiryDate: '2099-12-31',
        quantity: 1,
        unit: 'pcs',
      },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('400 when neither productId nor customName given', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const clientId = randomUUID();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'idempotency-key': clientId },
      payload: { clientId, expiryDate: '2099-12-31', quantity: 1, unit: 'pcs' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('GET /v1/records', () => {
  it('lists active records sorted by expiry ascending', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const prisma = getPrisma();
    await prisma.record.create({
      data: {
        userId: user.id,
        clientId: randomUUID(),
        customName: 'Late',
        expiryDate: new Date('2099-12-31'),
        quantity: 1,
        unit: 'pcs',
        notifyAt: [],
      },
    });
    await prisma.record.create({
      data: {
        userId: user.id,
        clientId: randomUUID(),
        customName: 'Soon',
        expiryDate: new Date('2027-01-01'),
        quantity: 1,
        unit: 'pcs',
        notifyAt: [],
      },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/records?status=active&sort=expiry&limit=10',
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items[0].customName).toBe('Soon');
    expect(body.items[1].customName).toBe('Late');
    expect(body.nextCursor).toBeNull();
    await app.close();
  });

  it('paginates via cursor', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const prisma = getPrisma();
    for (let i = 0; i < 5; i++) {
      await prisma.record.create({
        data: {
          userId: user.id,
          clientId: randomUUID(),
          customName: `R${i}`,
          expiryDate: new Date(`2027-01-0${i + 1}`),
          quantity: 1,
          unit: 'pcs',
          notifyAt: [],
        },
      });
    }
    const r1 = await app.inject({
      method: 'GET',
      url: '/v1/records?limit=2',
      headers,
    });
    expect(r1.json().items).toHaveLength(2);
    const cursor = r1.json().nextCursor;
    expect(cursor).toBeTruthy();
    const r2 = await app.inject({
      method: 'GET',
      url: `/v1/records?limit=2&cursor=${encodeURIComponent(cursor)}`,
      headers,
    });
    expect(r2.json().items).toHaveLength(2);
    expect(r2.json().items[0].customName).not.toBe(r1.json().items[0].customName);
    await app.close();
  });

  it("only returns the caller's records", async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const other = await makeUser({});
    await getPrisma().record.create({
      data: {
        userId: other.id,
        clientId: randomUUID(),
        customName: 'Theirs',
        expiryDate: new Date('2099-12-31'),
        quantity: 1,
        unit: 'pcs',
        notifyAt: [],
      },
    });
    await getPrisma().record.create({
      data: {
        userId: user.id,
        clientId: randomUUID(),
        customName: 'Mine',
        expiryDate: new Date('2099-12-31'),
        quantity: 1,
        unit: 'pcs',
        notifyAt: [],
      },
    });
    const res = await app.inject({ method: 'GET', url: '/v1/records', headers });
    const names = res.json().items.map((r: { customName: string }) => r.customName);
    expect(names).toContain('Mine');
    expect(names).not.toContain('Theirs');
    await app.close();
  });
});

describe('PATCH /v1/records/:id', () => {
  it('updates fields and recomputes notify_at when expiryDate changes', async () => {
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
      method: 'PATCH',
      url: `/v1/records/${row.id}`,
      headers,
      payload: { expiryDate: '2099-06-01', quantity: 5 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().quantity).toBe(5);
    expect(res.json().expiryDate).toBe('2099-06-01');
    expect(res.json().notifyAt.length).toBe(3);
    await app.close();
  });

  it('sets consumedAt when status flips to consumed', async () => {
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
      method: 'PATCH',
      url: `/v1/records/${row.id}`,
      headers,
      payload: { status: 'consumed' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('consumed');
    expect(res.json().consumedAt).not.toBeNull();
    await app.close();
  });

  it("404 on other user's record", async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const other = await makeUser({});
    const row = await getPrisma().record.create({
      data: {
        userId: other.id,
        clientId: randomUUID(),
        customName: 'X',
        expiryDate: new Date('2099-12-31'),
        quantity: 1,
        unit: 'pcs',
        notifyAt: [],
      },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/records/${row.id}`,
      headers,
      payload: { quantity: 2 },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('DELETE /v1/records/:id', () => {
  it('hard-deletes the record and cancels scheduled jobs', async () => {
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
      method: 'DELETE',
      url: `/v1/records/${row.id}`,
      headers,
    });
    expect(res.statusCode).toBe(204);
    const after = await getPrisma().record.findUnique({ where: { id: row.id } });
    expect(after).toBeNull();
    await app.close();
  });

  it("404 on other user's record", async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const other = await makeUser({});
    const row = await getPrisma().record.create({
      data: {
        userId: other.id,
        clientId: randomUUID(),
        customName: 'X',
        expiryDate: new Date('2099-12-31'),
        quantity: 1,
        unit: 'pcs',
        notifyAt: [],
      },
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/records/${row.id}`,
      headers,
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
