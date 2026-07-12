import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';
import { makeUser, makeUserWithCode, makeReferral, makeRecord } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { maybeActivateReferral } from '../../src/services/referrals/referral-service.js';

async function auth(uid: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user', tokenVersion: 0 })}` };
}

describe('POST /v1/auth/register with referralCode', () => {
  it('creates pending referral + sets referredByUserId when code is valid', async () => {
    const app = await buildServer();
    const referrer = await makeUserWithCode('VALIDAA2');
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/register',
      payload: { email: `ref-${Date.now()}@example.com`, password: 'sup3rSecret!', firstName: 'Bee', lastName: 'Cee', referralCode: 'VALIDAA2' },
    });
    expect(res.statusCode).toBe(201);
    const prisma = getPrisma();
    const created = await prisma.user.findUniqueOrThrow({ where: { email: res.json().user.email } });
    expect(created.referredByUserId).toBe(referrer.id);
    const ref = await prisma.referral.findUniqueOrThrow({ where: { referredUserId: created.id } });
    expect(ref.status).toBe('pending');
    expect(ref.referrerUserId).toBe(referrer.id);
    await app.close();
  });

  it('404 when code does not exist', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/register',
      payload: { email: `ref2-${Date.now()}@example.com`, password: 'sup3rSecret!', firstName: 'X', lastName: 'Y', referralCode: 'XXXXXXXX' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('referral_code_not_found');
    await app.close();
  });

  it('organic signup (no code) works unchanged', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/register',
      payload: { email: `organic-${Date.now()}@example.com`, password: 'sup3rSecret!', firstName: 'A', lastName: 'B' },
    });
    expect(res.statusCode).toBe(201);
    await app.close();
  });
});

describe('maybeActivateReferral', () => {
  it('activates referral when user reaches 5 records', async () => {
    const prisma = getPrisma();
    const referrer = await makeUserWithCode('ACTIVA23');
    const referred = await makeUser({ emailVerified: true });
    await makeReferral({ referrerUserId: referrer.id, referredUserId: referred.id, referralCode: 'ACTIVA23' });

    for (let i = 0; i < 4; i++) {
      await makeRecord(referred.id, { clientId: randomUUID() });
      await maybeActivateReferral(referred.id);
    }
    let ref = await prisma.referral.findUniqueOrThrow({ where: { referredUserId: referred.id } });
    expect(ref.status).toBe('pending'); // not yet at 5

    await makeRecord(referred.id, { clientId: randomUUID() });
    await maybeActivateReferral(referred.id);
    ref = await prisma.referral.findUniqueOrThrow({ where: { referredUserId: referred.id } });
    expect(ref.status).toBe('activated');
    expect(ref.activatedAt).not.toBeNull();
  });

  it('is idempotent — second call is a no-op', async () => {
    const prisma = getPrisma();
    const referrer = await makeUserWithCode('IDEMPOT2');
    const referred = await makeUser({ emailVerified: true });
    await makeReferral({ referrerUserId: referrer.id, referredUserId: referred.id, referralCode: 'IDEMPOT2' });
    for (let i = 0; i < 5; i++) await makeRecord(referred.id, { clientId: randomUUID() });
    await maybeActivateReferral(referred.id);
    await maybeActivateReferral(referred.id);
    const ref = await prisma.referral.findUniqueOrThrow({ where: { referredUserId: referred.id } });
    expect(ref.status).toBe('activated');
  });

  it('no-op when no pending referral', async () => {
    const user = await makeUser({ emailVerified: true });
    await expect(maybeActivateReferral(user.id)).resolves.toBeUndefined();
  });
});

describe('GET /v1/me/referral', () => {
  it('returns referral code and activatedCount', async () => {
    const app = await buildServer();
    const u = await makeUser({ emailVerified: true });
    const referred = await makeUser({ emailVerified: true });
    await getPrisma().user.update({ where: { id: u.id }, data: { referralCode: 'MYREFA23' } });
    await makeReferral({ referrerUserId: u.id, referredUserId: referred.id, referralCode: 'MYREFA23', status: 'activated' });
    const res = await app.inject({ method: 'GET', url: '/v1/me/referral', headers: await auth(u.id) });
    expect(res.statusCode).toBe(200);
    expect(res.json().referralCode).toBe('MYREFA23');
    expect(res.json().activatedCount).toBe(1);
    expect(res.json().shareUrl).toContain('MYREFA23');
    await app.close();
  });

  it('generates a code lazily if user has none', async () => {
    const app = await buildServer();
    const u = await makeUser({ emailVerified: true });
    const res = await app.inject({ method: 'GET', url: '/v1/me/referral', headers: await auth(u.id) });
    expect(res.statusCode).toBe(200);
    expect(res.json().referralCode).toMatch(/^[A-Z2-9]{8}$/);
    await app.close();
  });

  it('requires auth', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/v1/me/referral' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
