import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getRedis } from '../../src/redis.js';

describe('idempotency plugin', () => {
  it('replays the cached response on a duplicate key within TTL', async () => {
    const app = await buildServer();
    let calls = 0;
    app.post('/test-idem', { config: { idempotent: true } }, async (_req, reply) => {
      calls += 1;
      return reply.status(201).send({ count: calls });
    });
    const headers = { 'idempotency-key': 'abc-123' };
    const r1 = await app.inject({ method: 'POST', url: '/test-idem', headers });
    const r2 = await app.inject({ method: 'POST', url: '/test-idem', headers });
    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(201);
    expect(r1.body).toBe(r2.body);
    expect(calls).toBe(1);
    await app.close();
  });

  it('400 when Idempotency-Key is missing on a required route', async () => {
    const app = await buildServer();
    app.post('/test-idem-required', { config: { idempotent: 'required' } }, async (_req, reply) =>
      reply.send({ ok: true }),
    );
    const res = await app.inject({ method: 'POST', url: '/test-idem-required' });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('validation_error');
    await app.close();
  });

  it('different keys do not collide', async () => {
    const app = await buildServer();
    let calls = 0;
    app.post('/x', { config: { idempotent: true } }, async (_req, reply) => {
      calls += 1;
      return reply.send({ calls });
    });
    await app.inject({ method: 'POST', url: '/x', headers: { 'idempotency-key': 'a' } });
    await app.inject({ method: 'POST', url: '/x', headers: { 'idempotency-key': 'b' } });
    expect(calls).toBe(2);
    await app.close();
  });

  it('uses redis key with TTL', async () => {
    const app = await buildServer();
    app.post('/x', { config: { idempotent: true } }, async (_req, reply) => reply.send({}));
    await app.inject({ method: 'POST', url: '/x', headers: { 'idempotency-key': 'ttltest' } });
    const ttl = await getRedis().ttl('idem:/x:ttltest');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(86_400);
    await app.close();
  });
});
