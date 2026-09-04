import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser, makeHousehold } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';

async function headersFor(userId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: userId, role: 'user', tokenVersion: 0 })}`,
    'idempotency-key': randomUUID(),
  };
}

describe('/v1/me/preferences', () => {
  it('gets default preferences when none are set', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/me/preferences',
      headers: await headersFor(user.id),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.uiPreferences).toBeNull();
    await app.close();
  });

  it('updates uiPreferences with default pantry and menu position', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(user.id, { name: 'My Household' });

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/v1/me/preferences',
      headers: await headersFor(user.id),
      payload: {
        uiPreferences: {
          defaultPantryScope: 'household',
          defaultHouseholdId: hh.id,
          menuButtonPosition: { x: 280, y: 620 },
        },
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const body = patchRes.json();
    expect(body.uiPreferences).toEqual({
      defaultPantryScope: 'household',
      defaultHouseholdId: hh.id,
      menuButtonPosition: { x: 280, y: 620 },
    });

    const getRes = await app.inject({
      method: 'GET',
      url: '/v1/me/preferences',
      headers: await headersFor(user.id),
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().uiPreferences).toEqual({
      defaultPantryScope: 'household',
      defaultHouseholdId: hh.id,
      menuButtonPosition: { x: 280, y: 620 },
    });

    await app.close();
  });

  it('rejects with 403 if defaultHouseholdId is not a household user belongs to', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const otherUser = await makeUser({ emailVerified: true });
    const otherHh = await makeHousehold(otherUser.id, { name: 'Other Household' });

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me/preferences',
      headers: await headersFor(user.id),
      payload: {
        uiPreferences: {
          defaultPantryScope: 'household',
          defaultHouseholdId: otherHh.id,
        },
      },
    });

    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
