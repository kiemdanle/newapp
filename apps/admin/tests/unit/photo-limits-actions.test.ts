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
import { savePhotoLimitsAction } from '@/lib/actions';
import type { PhotoLimitsSettings } from '@expyrico/shared';

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

describe('Photo Limits Admin Settings API & Action', () => {
  const sampleSetting: PhotoLimitsSettings = {
    maxProductPhotos: 5,
    maxPantryItemPhotos: 5,
  };

  it('serverAdminApi.settings.photoLimits.get fetches and parses setting', async () => {
    mockFetchOnce(200, sampleSetting);

    const result = await serverAdminApi.settings.photoLimits.get();
    expect(result.maxProductPhotos).toBe(5);
    expect(result.maxPantryItemPhotos).toBe(5);
  });

  it('serverAdminApi.settings.photoLimits.patch sends updated limits', async () => {
    const updated: PhotoLimitsSettings = {
      maxProductPhotos: 8,
      maxPantryItemPhotos: 12,
    };
    mockFetchOnce(200, updated);

    const result = await serverAdminApi.settings.photoLimits.patch(updated);
    expect(result.maxProductPhotos).toBe(8);
    expect(result.maxPantryItemPhotos).toBe(12);
  });

  it('savePhotoLimitsAction persists setting and triggers revalidatePath', async () => {
    const updated: PhotoLimitsSettings = {
      maxProductPhotos: 8,
      maxPantryItemPhotos: 12,
    };
    mockFetchOnce(200, updated);

    const result = await savePhotoLimitsAction(updated);
    expect(result.maxProductPhotos).toBe(8);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings/photo-limits');
  });
});
