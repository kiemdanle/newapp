import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cookieStore = new Map<string, { value: string }>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { serverAdminApi } from '@/lib/admin-api';
import {
  updateBarcodeApiConfigAction,
  resetBarcodeApiProviderAction,
  probeBarcodeApiAction,
  fetchBarcodeApiRequestDetailAction,
} from '@/lib/actions';

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

describe('serverAdminApi barcode API operations', () => {
  it('fetches barcodeApiStats and parses through schema', async () => {
    mockFetchOnce(200, {
      range: '24h',
      summary: {
        totalCalls: 10,
        hitCount: 8,
        missCount: 2,
        errorCount: 0,
        rateLimitedCount: 0,
        timeoutCount: 0,
        cooldownSkippedCount: 0,
        hitRatePercent: 80,
        errorRatePercent: 0,
        avgDurationMs: 150,
        p95DurationMs: 250,
      },
      providers: {
        off: {
          name: 'OpenFoodFacts',
          enabled: true,
          dailyLimit: null,
          todayCallCount: 8,
          quotaRemaining: null,
          quotaPercentage: null,
          state: 'healthy',
          breakerState: 'closed',
          cooldownActive: false,
          cooldownRemainingSeconds: null,
          totalCalls: 8,
          hitCount: 7,
          missCount: 1,
          errorCount: 0,
          rateLimitedCount: 0,
          timeoutCount: 0,
          hitRatePercent: 87.5,
          errorRatePercent: 0,
          avgDurationMs: 140,
          p50DurationMs: 130,
          p95DurationMs: 220,
          p99DurationMs: 300,
          minDurationMs: 80,
          maxDurationMs: 350,
          timeoutMs: 3500,
          priority: 10,
        },
      },
      volumeTimeline: [],
      topBarcodes: [],
      topMisses: [],
    });

    const stats = await serverAdminApi.system.barcodeApiStats('24h');
    expect(stats.range).toBe('24h');
    expect(stats.summary.totalCalls).toBe(10);
    expect(stats.providers.off?.name).toBe('OpenFoodFacts');
  });

  it('fetches requests and parses paginated response', async () => {
    mockFetchOnce(200, {
      items: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          provider: 'off',
          barcode: '5449000000996',
          endpoint: 'https://world.openfoodfacts.org/api/v2/product/5449000000996.json',
          httpMethod: 'GET',
          status: 'hit',
          httpStatus: 200,
          durationMs: 140,
          errorMessage: null,
          responseSizeBytes: 1024,
          callerContext: 'sync_lookup',
          userId: null,
          createdAt: '2026-09-12T19:00:00.000Z',
        },
      ],
      nextCursor: null,
    });

    const res = await serverAdminApi.system.barcodeApiRequests({ range: '24h', limit: 10 });
    expect(res.items.length).toBe(1);
    expect(res.items[0]?.barcode).toBe('5449000000996');
  });

  it('updates provider config via updateBarcodeApiConfigAction', async () => {
    mockFetchOnce(200, {
      providers: {
        off: { enabled: true, timeoutMs: 4000, dailyLimit: null, priority: 10 },
      },
      retentionDays: 30,
    });

    const res = await updateBarcodeApiConfigAction({
      providers: {
        off: { timeoutMs: 4000 },
      },
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.providers['off']?.timeoutMs).toBe(4000);
    }
  });

  it('resets provider cooldown or breaker via resetBarcodeApiProviderAction', async () => {
    mockFetchOnce(200, {
      ok: true,
      provider: 'upcitemdb',
      target: 'cooldown',
    });

    const res = await resetBarcodeApiProviderAction({
      provider: 'upcitemdb',
      target: 'cooldown',
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.provider).toBe('upcitemdb');
    }
  });

  it('sends live probe via probeBarcodeApiAction', async () => {
    mockFetchOnce(200, {
      provider: 'off',
      barcode: '5449000000996',
      endpoint: 'https://world.openfoodfacts.org/api/v2/product/5449000000996.json',
      durationMs: 210,
      httpStatus: 200,
      status: 'hit',
      parsedProduct: { name: 'Coke', brand: 'Coca-Cola', found: true },
    });

    const res = await probeBarcodeApiAction({
      barcode: '5449000000996',
      provider: 'off',
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.status).toBe('hit');
      expect(res.data.parsedProduct?.name).toBe('Coke');
    }
  });

  it('fetches request detail via fetchBarcodeApiRequestDetailAction', async () => {
    mockFetchOnce(200, {
      id: '00000000-0000-0000-0000-000000000001',
      provider: 'off',
      barcode: '5449000000996',
      endpoint: 'https://world.openfoodfacts.org/api/v2/product/5449000000996.json',
      httpMethod: 'GET',
      status: 'hit',
      httpStatus: 200,
      durationMs: 140,
      errorMessage: null,
      responseSizeBytes: 1024,
      callerContext: 'sync_lookup',
      requestHeaders: { 'user-agent': 'PantryApp/1.0' },
      responseHeaders: { 'content-type': 'application/json' },
      rawResponsePreview: '{"code":"OK"}',
      userId: null,
      createdAt: '2026-09-12T19:00:00.000Z',
    });

    const res = await fetchBarcodeApiRequestDetailAction('00000000-0000-0000-0000-000000000001');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data?.barcode).toBe('5449000000996');
      expect(res.data?.rawResponsePreview).toBe('{"code":"OK"}');
    }
  });
});
