import { __reset } from '../../tests/mocks/expo-secure-store';
import { jsonResponse, problemResponse, queueFetch } from '../../tests/mocks/fetch';
import { apiClient } from './client';
import { secureStore } from '../auth/secure-store';
import { ApiError } from './errors';

describe('apiClient — happy path', () => {
  beforeEach(() => __reset());

  it('builds URLs with the /v1 prefix from expo-constants', async () => {
    const f = queueFetch(jsonResponse({ status: 'ok' }));
    await apiClient.request({ method: 'GET', path: '/health' });
    expect(f).toHaveBeenCalledTimes(1);
    const [url] = f.mock.calls[0]!;
    expect(url).toBe('http://localhost:4000/v1/health');
  });

  it('injects Authorization: Bearer <access> when a token is stored', async () => {
    await secureStore.setAccessToken('access-123');
    const f = queueFetch(jsonResponse({ ok: true }));
    await apiClient.request({ method: 'GET', path: '/me' });
    const init = f.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-123');
  });

  it('serialises JSON bodies and sets content-type', async () => {
    const f = queueFetch(jsonResponse({ ok: true }));
    await apiClient.request({ method: 'POST', path: '/auth/login', body: { email: 'a@b.c' } });
    const init = f.mock.calls[0]![1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ email: 'a@b.c' }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('returns parsed JSON for a 2xx response', async () => {
    queueFetch(jsonResponse({ hello: 'world' }));
    const result = await apiClient.request<{ hello: string }>({ method: 'GET', path: '/x' });
    expect(result).toEqual({ hello: 'world' });
  });

  it('throws ApiError carrying RFC 7807 fields on 4xx', async () => {
    queueFetch(problemResponse('invalid_credentials', 401, 'Invalid credentials'));
    await expect(apiClient.request({ method: 'POST', path: '/auth/login' })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('apiClient.get prepends /v1 to the path', async () => {
    const f = queueFetch(jsonResponse({ ok: true }));
    await apiClient.get<{ ok: true }>('/foo');
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('http://localhost:4000/v1/foo');
    expect((init as RequestInit).method).toBe('GET');
  });

  it('apiClient.post sends JSON body via convenience method', async () => {
    const f = queueFetch(jsonResponse({ ok: true }));
    await apiClient.post<{ ok: true }>('/bar', { x: 1 });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('http://localhost:4000/v1/bar');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).body).toBe(JSON.stringify({ x: 1 }));
  });
});

describe('apiClient — refresh on 401', () => {
  beforeEach(() => __reset());

  it('refreshes once on 401, replays the request, returns the success body', async () => {
    await secureStore.setAccessToken('expired');
    await secureStore.setRefreshToken('refresh-1');

    const f = queueFetch(
      problemResponse('token_expired', 401, 'expired'), // first call
      jsonResponse({ accessToken: 'new-access', refreshToken: 'refresh-2', expiresIn: 900 }), // refresh
      jsonResponse({ ok: true }), // replay
    );

    const result = await apiClient.request<{ ok: true }>({ method: 'GET', path: '/me' });
    expect(result).toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(3);
    expect(await secureStore.getAccessToken()).toBe('new-access');
    expect(await secureStore.getRefreshToken()).toBe('refresh-2');
  });

  it('does not retry when there is no refresh token', async () => {
    await secureStore.setAccessToken('expired');
    const f = queueFetch(problemResponse('token_expired', 401, 'expired'));
    await expect(apiClient.request({ method: 'GET', path: '/me' })).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('clears tokens and throws when refresh itself returns 401', async () => {
    await secureStore.setAccessToken('expired');
    await secureStore.setRefreshToken('bad-refresh');
    queueFetch(
      problemResponse('token_expired', 401, 'expired'),
      problemResponse('invalid_token', 401, 'refresh bad'),
    );
    await expect(apiClient.request({ method: 'GET', path: '/me' })).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(await secureStore.getAccessToken()).toBeNull();
    expect(await secureStore.getRefreshToken()).toBeNull();
  });

  it('only refreshes once even with concurrent failing requests, and both replays use the rotated token', async () => {
    await secureStore.setAccessToken('expired');
    await secureStore.setRefreshToken('refresh-1');
    const f = queueFetch(
      problemResponse('token_expired', 401, 'expired'),
      problemResponse('token_expired', 401, 'expired'),
      jsonResponse({ accessToken: 'new', refreshToken: 'r2', expiresIn: 900 }),
      jsonResponse({ a: 1 }),
      jsonResponse({ b: 2 }),
    );
    const [r1, r2] = await Promise.all([
      apiClient.request({ method: 'GET', path: '/a' }),
      apiClient.request({ method: 'GET', path: '/b' }),
    ]);
    expect(r1).toEqual({ a: 1 });
    expect(r2).toEqual({ b: 2 });
    const refreshIndex = f.mock.calls.findIndex(([url]) =>
      String(url).endsWith('/v1/auth/refresh'),
    );
    const refreshCalls = f.mock.calls.filter(([url]) => String(url).endsWith('/v1/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
    // A "replay" is a request issued AFTER the single refresh. The two initial
    // calls to /a and /b (which 401'd and triggered the refresh) legitimately
    // carry the stale token, so only assert on calls past the refresh index.
    const replayCalls = f.mock.calls.filter(([url], i) => {
      const s = String(url);
      return i > refreshIndex && (s.endsWith('/v1/a') || s.endsWith('/v1/b'));
    });
    expect(replayCalls).toHaveLength(2);
    for (const [, init] of replayCalls) {
      expect((init as RequestInit).headers as Record<string, string>).toMatchObject({
        Authorization: 'Bearer new',
      });
    }
    expect(await secureStore.getAccessToken()).toBe('new');
  });
});
