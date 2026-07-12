import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser, makeHousehold, makeMembership } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function auth(uid: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user', tokenVersion: 0 })}`,
    'idempotency-key': randomUUID(),
  };
}

describe('households CRUD', () => {
  it('creator becomes owner; appears in GET /mine; owner can rename', async () => {
    const app = await buildServer();
    const u = await makeUser({ emailVerified: true });
    const h = await auth(u.id);
    const created = await app.inject({
      method: 'POST', url: '/v1/households', headers: h, payload: { name: 'Flat 3B' },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    expect(created.json().myRole).toBe('owner');

    const mine = await app.inject({ method: 'GET', url: '/v1/households/mine', headers: h });
    expect(mine.json().items.map((x: { id: string }) => x.id)).toContain(id);

    const renamed = await app.inject({
      method: 'PATCH', url: `/v1/households/${id}`, headers: { ...h, 'idempotency-key': randomUUID() },
      payload: { name: 'Flat 3C' },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().name).toBe('Flat 3C');
    await app.close();
  });

  it('non-member cannot GET household detail', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const h = await makeHousehold(owner.id, { name: 'Private' });
    const stranger = await makeUser({ emailVerified: true });
    const res = await app.inject({
      method: 'GET', url: `/v1/households/${h.id}`,
      headers: await auth(stranger.id),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('household_not_member');
    await app.close();
  });

  it('non-owner cannot rename', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const h = await makeHousehold(owner.id);
    await makeMembership(h.id, member.id);
    const res = await app.inject({
      method: 'PATCH', url: `/v1/households/${h.id}`,
      headers: await auth(member.id),
      payload: { name: 'Nope' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe('household members', () => {
  it('owner adds member; member appears in list; owner removes member', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const newMember = await makeUser({ emailVerified: true });
    const h = await makeHousehold(owner.id);
    const ownerH = await auth(owner.id);

    const addRes = await app.inject({
      method: 'POST', url: `/v1/households/${h.id}/members`,
      headers: { ...ownerH, 'idempotency-key': randomUUID() },
      payload: { userId: newMember.id },
    });
    expect(addRes.statusCode).toBe(201);
    expect(addRes.json().userId).toBe(newMember.id);

    const listRes = await app.inject({ method: 'GET', url: `/v1/households/${h.id}/members`, headers: ownerH });
    expect(listRes.json().items.map((m: { userId: string }) => m.userId)).toContain(newMember.id);

    const removeRes = await app.inject({
      method: 'DELETE', url: `/v1/households/${h.id}/members/${newMember.id}`, headers: ownerH,
    });
    expect(removeRes.statusCode).toBe(204);
    const after = await getPrisma().householdMember.findMany({ where: { householdId: h.id } });
    expect(after.map((m) => m.userId)).not.toContain(newMember.id);
    await app.close();
  });

  it('member cannot remove another member', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const m1 = await makeUser({ emailVerified: true });
    const m2 = await makeUser({ emailVerified: true });
    const h = await makeHousehold(owner.id);
    await makeMembership(h.id, m1.id);
    await makeMembership(h.id, m2.id);
    const res = await app.inject({
      method: 'DELETE', url: `/v1/households/${h.id}/members/${m2.id}`,
      headers: await auth(m1.id),
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('owner cannot self-leave (must dissolve)', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const h = await makeHousehold(owner.id);
    const res = await app.inject({
      method: 'DELETE', url: `/v1/households/${h.id}/members/${owner.id}`,
      headers: await auth(owner.id),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('household_owner_cannot_leave');
    await app.close();
  });
});

describe('household dissolve', () => {
  it('dissolve deletes household; records revert to personal', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const h = await makeHousehold(owner.id);
    // Create a shared record
    const record = await getPrisma().record.create({
      data: {
        userId: owner.id, householdId: h.id, clientId: randomUUID(),
        customName: 'Shared item', expiryDate: new Date('2099-12-31'),
        quantity: 1, unit: 'pcs', notifyAt: [],
      },
    });
    const res = await app.inject({ method: 'DELETE', url: `/v1/households/${h.id}`, headers: await auth(owner.id) });
    expect(res.statusCode).toBe(204);
    const afterHousehold = await getPrisma().household.findUnique({ where: { id: h.id } });
    expect(afterHousehold).toBeNull();
    // Record should revert to personal (household_id = null)
    const afterRecord = await getPrisma().record.findUnique({ where: { id: record.id } });
    expect(afterRecord?.householdId).toBeNull();
    await app.close();
  });

  it('non-owner cannot dissolve', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const m = await makeUser({ emailVerified: true });
    const h = await makeHousehold(owner.id);
    await makeMembership(h.id, m.id);
    const res = await app.inject({ method: 'DELETE', url: `/v1/households/${h.id}`, headers: await auth(m.id) });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
