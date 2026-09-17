import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeUser } from '../helpers/factories.js';
import { clearGeocodeCache } from '../../src/services/geo/cache.js';

async function authHeaders(userId: string) {
  const token = await issueAccessToken({ sub: userId, role: 'user', tokenVersion: 0 });
  return { authorization: `Bearer ${token}` };
}

describe('GET /v1/geo/reverse-geocode', () => {
  beforeEach(() => {
    clearGeocodeCache();
    vi.restoreAllMocks();
    process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';
  });

  it('rejects unauthenticated requests with 401', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/geo/reverse-geocode?lat=10.7769&lng=106.7009',
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rejects invalid coordinates with 400', async () => {
    const app = await buildServer();
    const user = await makeUser({ email: `geo-test-${Date.now()}@test.local` });
    const headers = await authHeaders(user.id);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/geo/reverse-geocode?lat=95&lng=106.7009',
      headers,
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('reverse geocodes coordinates and returns privacy-safe address', async () => {
    const app = await buildServer();
    const user = await makeUser({ email: `geo-user-${Date.now()}@test.local` });
    const headers = await authHeaders(user.id);

    const fakeGoogleResponse = {
      status: 'OK',
      results: [
        {
          formatted_address: 'QPG2+HCR, 86 Le Thanh Ton, Ben Nghe, District 1, Ho Chi Minh City, Vietnam',
          address_components: [
            { long_name: '86', short_name: '86', types: ['street_number'] },
            { long_name: 'Le Thanh Ton', short_name: 'Le Thanh Ton', types: ['route'] },
            { long_name: 'Ben Nghe', short_name: 'Ben Nghe', types: ['sublocality_level_1'] },
            { long_name: 'District 1', short_name: 'District 1', types: ['administrative_area_level_2'] },
            { long_name: 'Ho Chi Minh City', short_name: 'Ho Chi Minh City', types: ['locality'] },
            { long_name: 'Vietnam', short_name: 'VN', types: ['country'] },
          ],
          types: ['street_address'],
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => fakeGoogleResponse,
    } as Response);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/geo/reverse-geocode?lat=10.7769&lng=106.7009',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.address).toBe('Le Thanh Ton, Ben Nghe, District 1, Ho Chi Minh City');
    expect(body.country).toBe('VN');
    expect(body.latitude).toBe(10.7769);
    expect(body.longitude).toBe(106.7009);
    expect(body.cached).toBe(false);

    // Second call should return cached: true without upstream fetch
    const cachedRes = await app.inject({
      method: 'GET',
      url: '/v1/geo/reverse-geocode?lat=10.7769&lng=106.7009',
      headers,
    });
    expect(cachedRes.statusCode).toBe(200);
    expect(cachedRes.json().cached).toBe(true);

    await app.close();
  });
});
