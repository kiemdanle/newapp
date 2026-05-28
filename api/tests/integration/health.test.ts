import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('health', () => {
  it('GET /health returns ok', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('GET /health/ready confirms DB and Redis', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ready' });
    await app.close();
  });
});
