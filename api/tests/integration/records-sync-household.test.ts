import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser, makeHousehold, makeMembership } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function headersFor(userId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: userId, role: 'user' })}`,
    'idempotency-key': randomUUID(),
  };
}

describe('records sync — split conflict policy', () => {
  it('personal records keep LWW: newer client overwrites', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const clientId = randomUUID();
    await getPrisma().record.create({
      data: {
        userId: user.id, householdId: null, clientId, customName: 'Old',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
        updatedAt: new Date('2020-01-01'),
      },
    });

    const res = await app.inject({
      method: 'POST', url: '/v1/records/sync',
      headers: await headersFor(user.id),
      payload: {
        since: null,
        upserts: [{ clientId, customName: 'New', expiryDate: '2099-12-31', quantity: 1, unit: 'pcs', updatedAt: new Date().toISOString() }],
        deletes: [],
      },
    });
    expect(res.statusCode).toBe(200);

    const row = await getPrisma().record.findUnique({ where: { clientId } });
    expect(row?.customName).toBe('New'); // LWW: client newer → wins
    await app.close();
  });

  it('household records are server-authoritative: client edit on conflict is rejected, server echoed back', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id, { name: 'Home' });
    const clientId = randomUUID();
    await getPrisma().record.create({
      data: {
        userId: owner.id, householdId: hh.id, clientId, customName: 'ServerCanonical',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
        updatedAt: new Date(),
      },
    });

    const res = await app.inject({
      method: 'POST', url: '/v1/records/sync',
      headers: await headersFor(owner.id),
      payload: {
        since: null,
        upserts: [{ clientId, householdId: hh.id, customName: 'ClientEdit', expiryDate: '2099-12-31', quantity: 9, unit: 'pcs', updatedAt: new Date('2020-01-01').toISOString() }],
        deletes: [],
      },
    });
    expect(res.statusCode).toBe(200);

    const row = await getPrisma().record.findUnique({ where: { clientId } });
    expect(row?.customName).toBe('ServerCanonical'); // server wins

    const echoed = res.json().changes.find((r: { clientId: string }) => r.clientId === clientId);
    expect(echoed?.customName).toBe('ServerCanonical');
    await app.close();
  });

  it('delta pull returns household records created by OTHER members', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id, { name: 'Home' });
    await makeMembership(hh.id, member.id, { role: 'member' });

    const clientId = randomUUID();
    await getPrisma().record.create({
      data: {
        userId: member.id, householdId: hh.id, clientId, customName: 'AddedByMember',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
      },
    });

    const res = await app.inject({
      method: 'POST', url: '/v1/records/sync',
      headers: await headersFor(owner.id),
      payload: { since: null, upserts: [], deletes: [] },
    });
    const names = res.json().changes.map((r: { customName: string }) => r.customName);
    expect(names).toContain('AddedByMember');
    await app.close();
  });

  it('delta re-filters by CURRENT visibility: a record that left the household is NOT echoed to former co-member', async () => {
    const app = await buildServer();
    const creator = await makeUser({ emailVerified: true });
    const other = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(creator.id, { name: 'Home' });
    await makeMembership(hh.id, other.id, { role: 'member' });

    const clientId = randomUUID();
    const rec = await getPrisma().record.create({
      data: {
        userId: creator.id, householdId: hh.id, clientId, customName: 'WasShared',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
      },
    });

    // Record reverts to creator-private (simulate partial member-remove of the creator)
    await getPrisma().record.update({ where: { id: rec.id }, data: { householdId: null, updatedAt: new Date() } });

    const res = await app.inject({
      method: 'POST', url: '/v1/records/sync',
      headers: await headersFor(other.id),
      payload: { since: null, upserts: [], deletes: [] },
    });
    const ids = res.json().changes.map((r: { clientId: string }) => r.clientId);
    expect(ids).not.toContain(clientId); // re-filtered out by current visibility
    await app.close();
  });

  it('scope-change conflict: household_id CHANGE is signalled as conflict, not silent overwrite', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id, { name: 'Home' });
    const clientId = randomUUID();

    // Server has promoted the record personal→household since the client last synced.
    await getPrisma().record.create({
      data: {
        userId: owner.id, householdId: hh.id, clientId, customName: 'NowShared',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
      },
    });

    // Client pushes a personal-era edit (householdId still null on its copy).
    const res = await app.inject({
      method: 'POST', url: '/v1/records/sync',
      headers: await headersFor(owner.id),
      payload: {
        since: null,
        upserts: [{ clientId, householdId: null, customName: 'OfflinePersonalEdit', expiryDate: '2099-12-31', quantity: 3, unit: 'pcs', updatedAt: new Date().toISOString() }],
        deletes: [],
      },
    });
    expect(res.statusCode).toBe(200);

    const conflicts = res.json().conflicts ?? [];
    expect(conflicts.map((c: { clientId: string }) => c.clientId)).toContain(clientId);
    const conflict = conflicts.find((c: { clientId: string }) => c.clientId === clientId);
    expect(conflict.reason).toBe('scope_changed');

    // The canonical (now-household) server row is echoed back.
    const echoed = res.json().changes.find((r: { clientId: string }) => r.clientId === clientId);
    expect(echoed.householdId).toBe(hh.id);
    expect(echoed.customName).toBe('NowShared');
    await app.close();
  });
});
