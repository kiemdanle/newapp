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
import { saveContributorLevelsAction } from '@/lib/actions';
import { DEFAULT_CONTRIBUTOR_LEVELS, type ContributorLevelsSetting } from '@expyrico/shared';

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

describe('Contributor Levels Admin Settings API & Action', () => {
  const sampleSetting: ContributorLevelsSetting = {
    enabled: true,
    levels: [...DEFAULT_CONTRIBUTOR_LEVELS],
  };

  it('serverAdminApi.settings.contributorLevels.get fetches and parses setting', async () => {
    mockFetchOnce(200, sampleSetting);

    const result = await serverAdminApi.settings.contributorLevels.get();
    expect(result.enabled).toBe(true);
    expect(result.levels).toHaveLength(10);
    expect(result.levels[0]?.level).toBe(1);
    expect(result.levels[0]?.title).toBe('Novice Scout');
  });

  it('serverAdminApi.settings.contributorLevels.patch sends updated levels', async () => {
    const updated = {
      enabled: false,
      levels: sampleSetting.levels.map((l, i) => ({
        ...l,
        minPoints: (i + 1) * 20,
      })),
    };
    mockFetchOnce(200, updated);

    const result = await serverAdminApi.settings.contributorLevels.patch(updated);
    expect(result.enabled).toBe(false);
    expect(result.levels[0]?.minPoints).toBe(20);
  });

  it('saveContributorLevelsAction persists setting and triggers revalidatePath', async () => {
    mockFetchOnce(200, sampleSetting);

    const result = await saveContributorLevelsAction(sampleSetting);
    expect(result.enabled).toBe(true);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings/contributor-levels');
  });
});
