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

describe('households join and invite code', () => {
  it('creates household with an auto-generated 6-character invite code', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/households',
      headers: await headersFor(owner.id),
      payload: { name: 'Dan Family Kitchen' },
    });

    expect(createRes.statusCode).toBe(201);
    const body = createRes.json();
    expect(body.inviteCode).toBeDefined();
    expect(typeof body.inviteCode).toBe('string');
    expect(body.inviteCode.length).toBe(6);
    await app.close();
  });

  it('previews household details via invite code', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true, firstName: 'Alice' });
    const user = await makeUser({ emailVerified: true });
    const prisma = getPrisma();

    const hh = await makeHousehold(owner.id, { name: 'Shared Apartment' });
    await prisma.household.update({
      where: { id: hh.id },
      data: { inviteCode: 'TEST99' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/households/invite/TEST99',
      headers: await headersFor(user.id),
    });

    expect(res.statusCode).toBe(200);
    const preview = res.json();
    expect(preview.id).toBe(hh.id);
    expect(preview.name).toBe('Shared Apartment');
    expect(preview.ownerName).toBe('Alice');
    expect(preview.memberCount).toBe(1);
    await app.close();
  });

  it('allows a new user to join household via 6-character invite code', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const invitee = await makeUser({ emailVerified: true });
    const prisma = getPrisma();

    const hh = await makeHousehold(owner.id, { name: 'Weekend Cabin' });
    await prisma.household.update({
      where: { id: hh.id },
      data: { inviteCode: 'CABIN7' },
    });

    const joinRes = await app.inject({
      method: 'POST',
      url: '/v1/households/join',
      headers: await headersFor(invitee.id),
      payload: { code: 'cabin7' }, // Case-insensitive test
    });

    expect(joinRes.statusCode).toBe(200);
    const body = joinRes.json();
    expect(body.id).toBe(hh.id);
    expect(body.myRole).toBe('member');
    expect(body.memberCount).toBe(2);

    // Verify membership row in database
    const membership = await prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId: hh.id, userId: invitee.id } },
    });
    expect(membership).not.toBeNull();
    expect(membership?.role).toBe('member');
    await app.close();
  });

  it('returns 404 when join code is invalid', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/households/join',
      headers: await headersFor(user.id),
      payload: { code: 'NONEXIST' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('household_not_found');
    await app.close();
  });

  it('returns 409 when user is already a member', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const prisma = getPrisma();

    const hh = await makeHousehold(owner.id);
    await prisma.household.update({
      where: { id: hh.id },
      data: { inviteCode: 'EXIST8' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/households/join',
      headers: await headersFor(owner.id),
      payload: { code: 'EXIST8' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('conflict');
    await app.close();
  });

  it('owner can regenerate invite code, while non-owner is rejected', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const prisma = getPrisma();

    const hh = await makeHousehold(owner.id);
    await makeMembership(hh.id, member.id, { role: 'member' });
    await prisma.household.update({
      where: { id: hh.id },
      data: { inviteCode: 'OLDCOD' },
    });

    // Member attempts regenerate -> 403
    const forbiddenRes = await app.inject({
      method: 'POST',
      url: `/v1/households/${hh.id}/regenerate-invite-code`,
      headers: await headersFor(member.id),
    });
    expect(forbiddenRes.statusCode).toBe(403);

    // Owner regenerates -> 200 with new code
    const regenRes = await app.inject({
      method: 'POST',
      url: `/v1/households/${hh.id}/regenerate-invite-code`,
      headers: await headersFor(owner.id),
    });
    expect(regenRes.statusCode).toBe(200);
    const newCode = regenRes.json().inviteCode;
    expect(newCode).toBeDefined();
    expect(newCode).not.toBe('OLDCOD');
    expect(newCode.length).toBe(6);

    // Verify DB updated
    const updated = await prisma.household.findUnique({ where: { id: hh.id } });
    expect(updated?.inviteCode).toBe(newCode);
    await app.close();
  });
});
