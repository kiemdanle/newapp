import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';

describe('GET /v1/admin/bullboard', () => {
  it('returns 401 when unauthenticated', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/bullboard' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
