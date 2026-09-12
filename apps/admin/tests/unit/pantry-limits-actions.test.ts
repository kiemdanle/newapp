import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cookieStore = new Map<string, { value: string }>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
  }),
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

import { serverAdminApi } from '@/lib/admin-api';
import { savePantryLimitsAction } from '@/lib/actions';
import type { PantryLimitsSettings } from '@expyrico/shared';

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

beforeEach(() => {
  process.env.API_BASE_URL = 'http://localhost:4000';
  process.env.COOKIE_SECURE = 'false';
  process.env.COOKIE_DOMAIN = '';
  cookieStore.clear();
  cookieStore.set('exp_access', { value: 'fake-admin-token' });
  mockRevalidatePath.mockClear();
});

afterEach(() => {
  process.env = { ...originalEnv };
  global.fetch = originalFetch;
  vi.resetModules();
});

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe('Pantry Limits Admin Settings API & Action', () => {
  const sampleSetting: PantryLimitsSettings = {
    defaultUserPantryLimit: 50,
    tierLimits: { free: 50, pro: 500 },
  };

  it('serverAdminApi.settings.pantryLimits.get fetches and parses setting', async () => {
    mockFetchOnce(200, sampleSetting);

    const result = await serverAdminApi.settings.pantryLimits.get();
    expect(result.defaultUserPantryLimit).toBe(50);
    expect(result.tierLimits).toEqual({ free: 50, pro: 500 });
  });

  it('serverAdminApi.settings.pantryLimits.patch sends updated limits', async () => {
    const updated: PantryLimitsSettings = {
      defaultUserPantryLimit: 100,
      tierLimits: { free: 50, pro: 500 },
    };
    mockFetchOnce(200, updated);

    const result = await serverAdminApi.settings.pantryLimits.patch({ defaultUserPantryLimit: 100 });
    expect(result.defaultUserPantryLimit).toBe(100);
  });

  it('savePantryLimitsAction persists setting and triggers revalidatePath', async () => {
    const updated: PantryLimitsSettings = {
      defaultUserPantryLimit: 250,
      tierLimits: { free: 50, pro: 500 },
    };
    mockFetchOnce(200, updated);

    const result = await savePantryLimitsAction({ defaultUserPantryLimit: 250 });
    expect(result.defaultUserPantryLimit).toBe(250);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings/pantry-limits');
  });
});
