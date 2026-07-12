import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser, makeHousehold, makeMembership, makeRecord } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function headersFor(userId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: userId, role: 'user', tokenVersion: 0 })}`,
    'idempotency-key': randomUUID(),
  };
}

describe('records household scope', () => {
  it('?scope=personal returns only personal records, excluding household ones', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);
    await makeMembership(hh.id, member.id, { role: 'member' });
    await makeRecord(member.id, { customName: 'Personal milk' });
    await makeRecord(member.id, { householdId: hh.id, customName: 'Shared bread' });

    const res = await app.inject({
      method: 'GET', url: '/v1/records?scope=personal',
      headers: await headersFor(member.id),
    });
    const names = res.json().items.map((r: { customName: string }) => r.customName);
    expect(names).toContain('Personal milk');
    expect(names).not.toContain('Shared bread');
    await app.close();
  });

  it('?scope=household returns only household records', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);
    await makeMembership(hh.id, member.id, { role: 'member' });
    await makeRecord(member.id, { customName: 'Personal eggs' });
    // A record created by another member in the same household
    const otherRec = await makeRecord(owner.id, { householdId: hh.id, customName: 'Shared cheese' });

    const res = await app.inject({
      method: 'GET', url: '/v1/records?scope=household',
      headers: await headersFor(member.id),
    });
    const names = res.json().items.map((r: { customName: string }) => r.customName);
    expect(names).toContain('Shared cheese');
    expect(names).not.toContain('Personal eggs');
    await app.close();
  });

  it('?scope=all returns both personal and household records', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);
    await makeMembership(hh.id, member.id, { role: 'member' });
    await makeRecord(member.id, { customName: 'Personal' });
    await makeRecord(owner.id, { householdId: hh.id, customName: 'Shared' });

    const res = await app.inject({
      method: 'GET', url: '/v1/records',
      headers: await headersFor(member.id),
    });
    const names = res.json().items.map((r: { customName: string }) => r.customName);
    expect(names).toContain('Personal');
    expect(names).toContain('Shared');
    await app.close();
  });

  it('?scope=household&householdId filters to specific household', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const hh1 = await makeHousehold(user.id, { name: 'Home' });
    const hh2owner = await makeUser({ emailVerified: true });
    const hh2 = await makeHousehold(hh2owner.id, { name: 'Office' });
    await makeMembership(hh2.id, user.id, { role: 'member' });
    await makeRecord(user.id, { householdId: hh1.id, customName: 'Home item' });
    await makeRecord(user.id, { householdId: hh2.id, customName: 'Office item' });

    const res = await app.inject({
      method: 'GET', url: `/v1/records?scope=household&householdId=${hh1.id}`,
      headers: await headersFor(user.id),
    });
    const names = res.json().items.map((r: { customName: string }) => r.customName);
    expect(names).toContain('Home item');
    expect(names).not.toContain('Office item');
    await app.close();
  });

  it('create record with householdId assigns to household', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);

    const res = await app.inject({
      method: 'POST', url: '/v1/records',
      headers: await headersFor(owner.id),
      payload: {
        clientId: randomUUID(), customName: 'Shared item', expiryDate: '2099-12-31',
        quantity: 1, unit: 'pcs', householdId: hh.id,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().householdId).toBe(hh.id);

    const row = await getPrisma().record.findUnique({ where: { id: res.json().id } });
    expect(row?.householdId).toBe(hh.id);
    expect(row?.userId).toBe(owner.id);
    await app.close();
  });

  it('create with householdId of a household caller is NOT in returns 403', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const stranger = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);

    const res = await app.inject({
      method: 'POST', url: '/v1/records',
      headers: await headersFor(stranger.id),
      payload: {
        clientId: randomUUID(), customName: 'Intruder', expiryDate: '2099-12-31',
        quantity: 1, unit: 'pcs', householdId: hh.id,
      },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('member can patch a household record created by another member', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);
    await makeMembership(hh.id, member.id, { role: 'member' });
    const rec = await makeRecord(owner.id, { householdId: hh.id, customName: 'Bread' });

    const res = await app.inject({
      method: 'PATCH', url: `/v1/records/${rec.id}`,
      headers: await headersFor(member.id),
      payload: { customName: 'Sourdough' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().customName).toBe('Sourdough');
    await app.close();
  });

  it('non-member gets 404/403 patching a household record (never leak existence)', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const stranger = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);
    const rec = await makeRecord(owner.id, { householdId: hh.id, customName: 'Secret' });

    const res = await app.inject({
      method: 'PATCH', url: `/v1/records/${rec.id}`,
      headers: await headersFor(stranger.id),
      payload: { customName: 'Hacked' },
    });
    expect([403, 404]).toContain(res.statusCode);
    await app.close();
  });

  it('cannot pull another user\'s personal record into own household (IDOR)', async () => {
    const app = await buildServer();
    const alice = await makeUser({ emailVerified: true });
    const bob = await makeUser({ emailVerified: true });
    const bobsHousehold = await makeHousehold(bob.id);
    const alicesRecord = await makeRecord(alice.id, { customName: 'Alice private' });

    const res = await app.inject({
      method: 'PATCH', url: `/v1/records/${alicesRecord.id}`,
      headers: await headersFor(bob.id),
      payload: { householdId: bobsHousehold.id },
    });
    expect(res.statusCode).toBe(404);
    const row = await getPrisma().record.findUnique({ where: { id: alicesRecord.id } });
    expect(row?.householdId).toBeNull(); // untouched
    await app.close();
  });

  it('reassigning to a household caller is not a member of returns 403', async () => {
    const app = await buildServer();
    const alice = await makeUser({ emailVerified: true });
    const bob = await makeUser({ emailVerified: true });
    const bobsHousehold = await makeHousehold(bob.id);
    // Alice creates a personal record and tries to move it into Bob's household
    const rec = await makeRecord(alice.id, { customName: 'To be moved' });

    const res = await app.inject({
      method: 'PATCH', url: `/v1/records/${rec.id}`,
      headers: await headersFor(alice.id),
      payload: { householdId: bobsHousehold.id },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
