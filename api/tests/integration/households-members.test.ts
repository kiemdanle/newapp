import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser, makeHousehold, makeMembership } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function headersFor(userId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: userId, role: 'user', tokenVersion: 0 })}`,
    'idempotency-key': randomUUID(),
  };
}

describe('households members', () => {
  it('owner adds a member profile, lists members with roles', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id, { name: 'Home' });

    const addRes = await app.inject({
      method: 'POST', url: `/v1/households/${hh.id}/members`,
      headers: await headersFor(owner.id), payload: { userId: member.id },
    });
    expect(addRes.statusCode).toBe(201);
    expect(addRes.json().userId).toBe(member.id);
    expect(addRes.json().role).toBe('member');

    const listRes = await app.inject({
      method: 'GET', url: `/v1/households/${hh.id}/members`,
      headers: await headersFor(owner.id),
    });
    expect(listRes.statusCode).toBe(200);
    const ids = listRes.json().items.map((m: { userId: string }) => m.userId);
    expect(ids).toContain(owner.id);
    expect(ids).toContain(member.id);
    await app.close();
  });

  it('member sees the members list', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);
    await makeMembership(hh.id, member.id, { role: 'member' });

    const res = await app.inject({
      method: 'GET', url: `/v1/households/${hh.id}/members`,
      headers: await headersFor(member.id),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items.length).toBeGreaterThanOrEqual(2);
    await app.close();
  });

  it('non-owner cannot add a member', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const outsider = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);
    await makeMembership(hh.id, member.id, { role: 'member' });

    const res = await app.inject({
      method: 'POST', url: `/v1/households/${hh.id}/members`,
      headers: await headersFor(member.id), payload: { userId: outsider.id },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('household_forbidden');
    await app.close();
  });

  it('owner removes a member', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);
    await makeMembership(hh.id, member.id, { role: 'member' });

    const res = await app.inject({
      method: 'DELETE', url: `/v1/households/${hh.id}/members/${member.id}`,
      headers: await headersFor(owner.id),
    });
    expect(res.statusCode).toBe(204);

    const row = await getPrisma().householdMember.findUnique({
      where: { householdId_userId: { householdId: hh.id, userId: member.id } },
    });
    expect(row).toBeNull();
    await app.close();
  });

  it('member self-leaves', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);
    await makeMembership(hh.id, member.id, { role: 'member' });

    const res = await app.inject({
      method: 'DELETE', url: `/v1/households/${hh.id}/members/${member.id}`,
      headers: await headersFor(member.id),
    });
    expect(res.statusCode).toBe(204);
    await app.close();
  });

  it('owner cannot self-leave', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);

    const res = await app.inject({
      method: 'DELETE', url: `/v1/households/${hh.id}/members/${owner.id}`,
      headers: await headersFor(owner.id),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('household_owner_cannot_leave');
    await app.close();
  });

  it('removing a non-member returns 404', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const stranger = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);

    const res = await app.inject({
      method: 'DELETE', url: `/v1/households/${hh.id}/members/${stranger.id}`,
      headers: await headersFor(owner.id),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('member_not_found');
    await app.close();
  });

  it('duplicate add returns 409 conflict', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);
    await makeMembership(hh.id, member.id, { role: 'member' });

    const res = await app.inject({
      method: 'POST', url: `/v1/households/${hh.id}/members`,
      headers: await headersFor(owner.id), payload: { userId: member.id },
    });
    expect(res.statusCode).toBe(409);
    await app.close();
  });
});
