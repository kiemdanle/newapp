import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeGiveaway, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function auth(uid: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user', tokenVersion: 0 })}` };
}
async function authIdem(uid: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user', tokenVersion: 0 })}`, 'idempotency-key': randomUUID() };
}

describe('GET /v1/giveaways', () => {
  it('returns open giveaways sorted by createdAt DESC', async () => {
    const app = await buildServer();
    const giver = await makeUser({ email: `gi-${Date.now()}@t.l` });
    const g1 = await makeGiveaway({ giverUserId: giver.id, title: 'G1' });
    await new Promise((r) => setTimeout(r, 10));
    const g2 = await makeGiveaway({ giverUserId: giver.id, title: 'G2' });
    const res = await app.inject({ method: 'GET', url: '/v1/giveaways' });
    expect(res.statusCode).toBe(200);
    const ids = res.json().items.map((x: { id: string }) => x.id);
    expect(ids.indexOf(g2.id)).toBeLessThan(ids.indexOf(g1.id));
    await app.close();
  });

  it('excludes cancelled/completed by default', async () => {
    const app = await buildServer();
    const u = await makeUser({ email: `gf-${Date.now()}@t.l` });
    const open = await makeGiveaway({ giverUserId: u.id, status: 'open' });
    await makeGiveaway({ giverUserId: u.id, status: 'cancelled' });
    const res = await app.inject({ method: 'GET', url: '/v1/giveaways' });
    const ids = res.json().items.map((x: { id: string }) => x.id);
    expect(ids).toContain(open.id);
    await app.close();
  });

  it('scopes to viewer country — country-A giveaway absent from country-B viewer', async () => {
    const app = await buildServer();
    const giver = await makeUser({ email: `gca-${Date.now()}@t.l`, country: 'US' });
    const viewerB = await makeUser({ email: `gcb-${Date.now()}@t.l`, country: 'GB' });
    const g = await makeGiveaway({ giverUserId: giver.id, country: 'US' });
    const res = await app.inject({ method: 'GET', url: '/v1/giveaways', headers: await auth(viewerB.id) });
    expect(res.json().items.map((x: { id: string }) => x.id)).not.toContain(g.id);
    await app.close();
  });

  it('global fallback when viewer has no country', async () => {
    const app = await buildServer();
    const giver = await makeUser({ email: `ggp-${Date.now()}@t.l`, country: 'US' });
    const viewerNoCountry = await makeUser({ email: `ggn-${Date.now()}@t.l`, country: null });
    const g = await makeGiveaway({ giverUserId: giver.id, country: 'US' });
    const res = await app.inject({ method: 'GET', url: '/v1/giveaways', headers: await auth(viewerNoCountry.id) });
    expect(res.json().items.map((x: { id: string }) => x.id)).toContain(g.id);
    await app.close();
  });
});

describe('POST /v1/giveaways', () => {
  it('creates an open giveaway stamped with poster country', async () => {
    const app = await buildServer();
    const giver = await makeUser({ emailVerified: true, country: 'VN' });
    const res = await app.inject({
      method: 'POST', url: '/v1/giveaways',
      headers: await authIdem(giver.id),
      payload: { title: 'Free rice bag', locationText: 'District 1' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('open');
    expect(res.json().country).toBe('VN');
    await app.close();
  });

  it('requires auth', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST', url: '/v1/giveaways',
      headers: { 'idempotency-key': randomUUID() },
      payload: { title: 'T', locationText: 'L' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('requires Idempotency-Key', async () => {
    const app = await buildServer();
    const u = await makeUser({ emailVerified: true });
    const res = await app.inject({
      method: 'POST', url: '/v1/giveaways',
      headers: await auth(u.id),
      payload: { title: 'T', locationText: 'L' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('GET /v1/giveaways/:id', () => {
  it('returns giveaway with giver and claimCount', async () => {
    const app = await buildServer();
    const giver = await makeUser({ email: `gg-${Date.now()}@t.l` });
    const g = await makeGiveaway({ giverUserId: giver.id });
    const res = await app.inject({ method: 'GET', url: `/v1/giveaways/${g.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().giver.id).toBe(giver.id);
    expect(res.json().claimCount).toBe(0);
    await app.close();
  });
});

describe('PATCH /v1/giveaways/:id', () => {
  it('owner can edit open giveaway', async () => {
    const app = await buildServer();
    const u = await makeUser({ emailVerified: true });
    const g = await makeGiveaway({ giverUserId: u.id });
    const res = await app.inject({
      method: 'PATCH', url: `/v1/giveaways/${g.id}`,
      headers: await auth(u.id),
      payload: { title: 'Updated title' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('Updated title');
    await app.close();
  });

  it('non-owner gets 403', async () => {
    const app = await buildServer();
    const u1 = await makeUser({ email: `po1-${Date.now()}@t.l` });
    const u2 = await makeUser({ email: `po2-${Date.now()}@t.l` });
    const g = await makeGiveaway({ giverUserId: u1.id });
    const res = await app.inject({ method: 'PATCH', url: `/v1/giveaways/${g.id}`, headers: await auth(u2.id), payload: { title: 'Updated title here' } });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe('POST /v1/giveaways/:id/cancel', () => {
  it('owner can cancel open giveaway', async () => {
    const app = await buildServer();
    const u = await makeUser({ emailVerified: true });
    const g = await makeGiveaway({ giverUserId: u.id });
    const res = await app.inject({ method: 'POST', url: `/v1/giveaways/${g.id}/cancel`, headers: await auth(u.id) });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('cancelled');
    await app.close();
  });

  it('cannot cancel a completed giveaway', async () => {
    const app = await buildServer();
    const u = await makeUser({ emailVerified: true });
    const g = await makeGiveaway({ giverUserId: u.id, status: 'completed' });
    const res = await app.inject({ method: 'POST', url: `/v1/giveaways/${g.id}/cancel`, headers: await auth(u.id) });
    expect(res.statusCode).toBe(409);
    await app.close();
  });
});

describe('claims + select + hand-off + confirm flow', () => {
  it('full giveaway lifecycle', async () => {
    const app = await buildServer();
    const giver = await makeUser({ email: `fl-giver-${Date.now()}@t.l`, emailVerified: true });
    const claimer = await makeUser({ email: `fl-claim-${Date.now()}@t.l`, emailVerified: true });
    const g = await makeGiveaway({ giverUserId: giver.id });

    // Claimer claims
    const claimRes = await app.inject({
      method: 'POST', url: `/v1/giveaways/${g.id}/claims`,
      headers: await authIdem(claimer.id),
      payload: { pickupNote: 'I can pick up at 5pm' },
    });
    expect(claimRes.statusCode).toBe(201);
    const claimId = claimRes.json().id;

    // Giver sees claims (note withheld)
    const claimsRes = await app.inject({ method: 'GET', url: `/v1/giveaways/${g.id}/claims`, headers: await auth(giver.id) });
    expect(claimsRes.json().items[0].pickupNote).toBeNull(); // pre-selection: redacted

    // Giver selects
    const selectRes = await app.inject({
      method: 'POST', url: `/v1/giveaways/${g.id}/select`,
      headers: await authIdem(giver.id),
      payload: { claimId },
    });
    expect(selectRes.statusCode).toBe(200);
    expect(selectRes.json().status).toBe('claimed');

    // Giver hands off
    const handOffRes = await app.inject({
      method: 'POST', url: `/v1/giveaways/${g.id}/hand-off`,
      headers: await authIdem(giver.id),
    });
    expect(handOffRes.statusCode).toBe(200);
    expect(handOffRes.json().status).toBe('handed_off');

    // Recipient confirms
    const confirmRes = await app.inject({
      method: 'POST', url: `/v1/giveaways/${g.id}/confirm-received`,
      headers: await authIdem(claimer.id),
    });
    expect(confirmRes.statusCode).toBe(200);
    expect(confirmRes.json().status).toBe('completed');

    // Both rate
    const rateGiver = await app.inject({
      method: 'POST', url: `/v1/giveaways/${g.id}/ratings`,
      headers: await authIdem(giver.id),
      payload: { stars: 5, comment: 'Great pickup' },
    });
    expect(rateGiver.statusCode).toBe(201);

    const rateClaimer = await app.inject({
      method: 'POST', url: `/v1/giveaways/${g.id}/ratings`,
      headers: await authIdem(claimer.id),
      payload: { stars: 4 },
    });
    expect(rateClaimer.statusCode).toBe(201);

    // Verify reputation updated
    const repClaimer = await app.inject({ method: 'GET', url: `/v1/users/${claimer.id}/reputation` });
    expect(repClaimer.statusCode).toBe(200);
    expect(repClaimer.json().transactionCount).toBe(1);

    await app.close();
  });
});
