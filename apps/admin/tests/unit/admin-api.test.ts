import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `apiServerFetch` (lib/api.ts) reads the access-token cookie via `next/headers`,
// which requires a live Next.js request scope. Outside that scope (a plain
// vitest run) it throws — so the whole module is replaced with a fake cookie
// jar the tests control directly, exactly the seam a Server Component/Server
// Action would go through in production.
const cookieStore = new Map<string, { value: string }>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
  }),
}));

import { ApiError, apiServerFetch } from '@/lib/api';
import { serverAdminApi } from '@/lib/admin-api';
import { COOKIE_NAMES } from '@/lib/cookies';

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

beforeEach(() => {
  process.env.API_BASE_URL = 'http://localhost:4000';
  process.env.COOKIE_SECURE = 'false';
  process.env.COOKIE_DOMAIN = '';
  cookieStore.clear();
});

afterEach(() => {
  process.env = { ...originalEnv };
  global.fetch = originalFetch;
  vi.resetModules();
});

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe('apiServerFetch / ApiError', () => {
  it('forwards the access cookie as a Bearer token', async () => {
    cookieStore.set(COOKIE_NAMES.access, { value: 'token-abc' });
    let capturedHeaders: Record<string, string> = {};
    global.fetch = vi.fn(async (_url, init) => {
      capturedHeaders = (init as RequestInit).headers as Record<string, string>;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;

    await apiServerFetch('/v1/admin/products/abc');
    expect(capturedHeaders.authorization).toBe('Bearer token-abc');
  });

  it('throws a plain ApiError with status/code on a 401', async () => {
    mockFetchOnce(401, { code: 'unauthorized', detail: 'no session' });
    await expect(apiServerFetch('/v1/admin/products/abc')).rejects.toMatchObject({
      status: 401,
      code: 'unauthorized',
      detail: 'no session',
    });
  });

  it('throws a plain ApiError with status/code on a 403', async () => {
    mockFetchOnce(403, { code: 'forbidden' });
    await expect(apiServerFetch('/v1/admin/products/abc')).rejects.toMatchObject({
      status: 403,
      code: 'forbidden',
    });
  });

  it('surfaces the structured currentVersion on a version_conflict problem', async () => {
    mockFetchOnce(409, { code: 'version_conflict', currentVersion: 7 });
    try {
      await apiServerFetch('/v1/admin/products/abc');
      expect.unreachable('expected apiServerFetch to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe('version_conflict');
      expect((e as ApiError).currentVersion).toBe(7);
    }
  });

  it('surfaces the structured identifierConflict on a merge conflict problem', async () => {
    const identifierConflict = { slot: 'barcode' as const, sourceValue: '111', targetValue: '222' };
    mockFetchOnce(409, { code: 'identifier_conflict', identifierConflict });
    try {
      await apiServerFetch('/v1/admin/products/abc/merge', { method: 'POST', body: {} });
      expect.unreachable('expected apiServerFetch to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).identifierConflict).toEqual(identifierConflict);
    }
  });

  it('tolerates a non-JSON error body without losing the status code', async () => {
    global.fetch = vi.fn(async () => new Response('not json', { status: 500 })) as unknown as typeof fetch;
    await expect(apiServerFetch('/v1/admin/products/abc')).rejects.toMatchObject({
      status: 500,
      code: 'unknown_error',
    });
  });
});

describe('serverAdminApi.users password operations', () => {
  it('calls changePassword and parses valid response', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    mockFetchOnce(200, { ok: true, userId, message: 'Password updated successfully.' });

    const res = await serverAdminApi.users.changePassword(userId, { password: 'new-secure-password-123' });
    expect(res.ok).toBe(true);
    expect(res.userId).toBe(userId);
  });

  it('calls sendRandomPassword and parses valid response', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    mockFetchOnce(200, { ok: true, userId, message: 'A temporary random password has been generated and sent to the user email.' });

    const res = await serverAdminApi.users.sendRandomPassword(userId, { notes: 'Phone support' });
    expect(res.ok).toBe(true);
    expect(res.userId).toBe(userId);
  });
});
