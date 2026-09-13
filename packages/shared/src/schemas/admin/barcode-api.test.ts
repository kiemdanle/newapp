import { describe, expect, it } from 'vitest';
import {
  barcodeApiStatusSchema,
  barcodeApiCallerContextSchema,
  barcodeApiCallLogRowSchema,
  barcodeApiCallLogDetailSchema,
  barcodeApiRequestsQuerySchema,
  barcodeApiConfigSchema,
  barcodeApiConfigPatchSchema,
  barcodeApiProbeRequestSchema,
  barcodeApiProbeResponseSchema,
  barcodeApiResetActionSchema,
  barcodeApiStatsSchema,
} from './barcode-api.js';

describe('barcodeApiStatusSchema', () => {
  it('accepts all 6 valid statuses', () => {
    const statuses = ['hit', 'miss', 'rate_limited', 'timeout', 'error', 'cooldown_skipped'] as const;
    for (const s of statuses) {
      expect(barcodeApiStatusSchema.parse(s)).toBe(s);
    }
  });

  it('rejects invalid statuses', () => {
    expect(() => barcodeApiStatusSchema.parse('success')).toThrow();
    expect(() => barcodeApiStatusSchema.parse('')).toThrow();
    expect(() => barcodeApiStatusSchema.parse('failed')).toThrow();
  });
});

describe('barcodeApiCallerContextSchema', () => {
  it('accepts all valid caller contexts', () => {
    expect(barcodeApiCallerContextSchema.parse('sync_lookup')).toBe('sync_lookup');
    expect(barcodeApiCallerContextSchema.parse('backfill_worker')).toBe('backfill_worker');
    expect(barcodeApiCallerContextSchema.parse('admin_probe')).toBe('admin_probe');
  });

  it('rejects invalid caller contexts', () => {
    expect(() => barcodeApiCallerContextSchema.parse('user')).toThrow();
    expect(() => barcodeApiCallerContextSchema.parse('')).toThrow();
  });
});

describe('barcodeApiCallLogRowSchema & detail schema', () => {
  const sampleRow = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    provider: 'upcitemdb',
    barcode: '012345678901',
    endpoint: 'https://api.upcitemdb.com/prod/trial/lookup',
    httpMethod: 'GET',
    status: 'hit',
    httpStatus: 200,
    durationMs: 245,
    errorMessage: null,
    responseSizeBytes: 1024,
    callerContext: 'sync_lookup',
    userId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    createdAt: '2026-09-12T19:00:00.000Z',
  };

  it('validates a correct row schema', () => {
    const parsed = barcodeApiCallLogRowSchema.parse(sampleRow);
    expect(parsed.id).toBe(sampleRow.id);
    expect(parsed.status).toBe('hit');
    expect(parsed.httpStatus).toBe(200);
  });

  it('validates detail schema with headers and preview', () => {
    const detail = {
      ...sampleRow,
      requestHeaders: { 'user-agent': 'Expyrico-API' },
      responseHeaders: { 'content-type': 'application/json' },
      rawResponsePreview: '{"code":"OK","items":[]}',
    };
    const parsed = barcodeApiCallLogDetailSchema.parse(detail);
    expect(parsed.requestHeaders).toEqual({ 'user-agent': 'Expyrico-API' });
    expect(parsed.rawResponsePreview).toBe('{"code":"OK","items":[]}');
  });
});

describe('barcodeApiRequestsQuerySchema', () => {
  it('applies default range and limit', () => {
    const parsed = barcodeApiRequestsQuerySchema.parse({});
    expect(parsed.range).toBe('24h');
    expect(parsed.limit).toBe(50);
    expect(parsed.cursor).toBeUndefined();
  });

  it('accepts valid filters', () => {
    const parsed = barcodeApiRequestsQuerySchema.parse({
      provider: 'off',
      status: 'rate_limited',
      callerContext: 'admin_probe',
      range: '7d',
      limit: '25',
    });
    expect(parsed.provider).toBe('off');
    expect(parsed.status).toBe('rate_limited');
    expect(parsed.callerContext).toBe('admin_probe');
    expect(parsed.range).toBe('7d');
    expect(parsed.limit).toBe(25);
  });
});

describe('barcodeApiConfigSchema & barcodeApiConfigPatchSchema', () => {
  it('defaults retentionDays to 30 in full config schema', () => {
    const parsed = barcodeApiConfigSchema.parse({
      providers: {
        off: { enabled: true, timeoutMs: 3000, dailyLimit: null, priority: 10 },
      },
    });
    expect(parsed.retentionDays).toBe(30);
  });

  it('accepts null retentionDays (unlimited) in full config schema', () => {
    const parsed = barcodeApiConfigSchema.parse({
      providers: {},
      retentionDays: null,
    });
    expect(parsed.retentionDays).toBeNull();
  });

  it('rejects retentionDays below 7 in full config schema', () => {
    expect(() =>
      barcodeApiConfigSchema.parse({
        providers: {},
        retentionDays: 5,
      }),
    ).toThrow();
  });

  it('CRITICAL: barcodeApiConfigPatchSchema leaves omitted retentionDays as undefined (NOT 30)', () => {
    const parsedEmpty = barcodeApiConfigPatchSchema.parse({});
    expect(parsedEmpty.retentionDays).toBeUndefined();

    const parsedTimeoutPatch = barcodeApiConfigPatchSchema.parse({
      providers: {
        off: { timeoutMs: 4000 },
      },
    });
    expect(parsedTimeoutPatch.retentionDays).toBeUndefined();
    expect(parsedTimeoutPatch.providers?.off?.timeoutMs).toBe(4000);
  });

  it('barcodeApiConfigPatchSchema allows explicit null (unlimited retention)', () => {
    const parsed = barcodeApiConfigPatchSchema.parse({
      retentionDays: null,
    });
    expect(parsed.retentionDays).toBeNull();
  });

  it('barcodeApiConfigPatchSchema allows explicit valid number', () => {
    const parsed = barcodeApiConfigPatchSchema.parse({
      retentionDays: 60,
    });
    expect(parsed.retentionDays).toBe(60);
  });

  it('barcodeApiConfigPatchSchema rejects number below 7', () => {
    expect(() =>
      barcodeApiConfigPatchSchema.parse({
        retentionDays: 3,
      }),
    ).toThrow();
  });
});

describe('barcodeApiProbeRequestSchema & barcodeApiProbeResponseSchema', () => {
  it('validates probe request', () => {
    const req = barcodeApiProbeRequestSchema.parse({
      barcode: '1234567890',
      provider: 'upcitemdb',
    });
    expect(req.barcode).toBe('1234567890');
    expect(req.provider).toBe('upcitemdb');
  });

  it('validates probe response', () => {
    const res = barcodeApiProbeResponseSchema.parse({
      provider: 'off',
      barcode: '1234567890',
      endpoint: 'https://world.openfoodfacts.org/api/v2/product/1234567890',
      durationMs: 312,
      httpStatus: 200,
      status: 'hit',
      parsedProduct: {
        name: 'Sparkling Water',
        brand: 'BrandX',
        found: true,
      },
    });
    expect(res.status).toBe('hit');
    expect(res.parsedProduct?.found).toBe(true);
  });
});

describe('barcodeApiResetActionSchema', () => {
  it('accepts valid targets', () => {
    expect(barcodeApiResetActionSchema.parse({ provider: 'upcitemdb', target: 'cooldown' })).toEqual({
      provider: 'upcitemdb',
      target: 'cooldown',
    });
    expect(barcodeApiResetActionSchema.parse({ provider: 'off', target: 'breaker' })).toEqual({
      provider: 'off',
      target: 'breaker',
    });
    expect(barcodeApiResetActionSchema.parse({ provider: 'upcitemdb', target: 'all' })).toEqual({
      provider: 'upcitemdb',
      target: 'all',
    });
  });

  it('rejects invalid target', () => {
    expect(() => barcodeApiResetActionSchema.parse({ provider: 'upcitemdb', target: 'invalid' })).toThrow();
  });
});

describe('barcodeApiStatsSchema', () => {
  it('validates full stats payload structure', () => {
    const fullStats = {
      range: '24h',
      summary: {
        totalCalls: 100,
        hitCount: 80,
        missCount: 15,
        errorCount: 5,
        rateLimitedCount: 2,
        timeoutCount: 1,
        cooldownSkippedCount: 0,
        hitRatePercent: 80,
        errorRatePercent: 5,
        avgDurationMs: 250,
        p95DurationMs: 600,
      },
      providers: {
        upcitemdb: {
          name: 'UPCitemdb',
          enabled: true,
          dailyLimit: 100,
          todayCallCount: 42,
          quotaRemaining: 58,
          quotaPercentage: 42,
          state: 'healthy',
          breakerState: 'closed',
          cooldownActive: false,
          cooldownRemainingSeconds: null,
          totalCalls: 42,
          hitCount: 30,
          missCount: 10,
          errorCount: 2,
          rateLimitedCount: 1,
          timeoutCount: 0,
          hitRatePercent: 71.4,
          errorRatePercent: 4.8,
          avgDurationMs: 220,
          p50DurationMs: 210,
          p95DurationMs: 500,
          p99DurationMs: 800,
          minDurationMs: 120,
          maxDurationMs: 950,
          timeoutMs: 3000,
          priority: 20,
        },
      },
      volumeTimeline: [
        {
          timestamp: '2026-09-12T18:00:00.000Z',
          total: 10,
          hits: 8,
          misses: 2,
          errors: 0,
          rateLimited: 0,
          timeouts: 0,
          byProvider: { upcitemdb: 10 },
        },
      ],
      topBarcodes: [
        {
          barcode: '012345678901',
          totalCalls: 5,
          hitCount: 5,
          missCount: 0,
          lastQueriedAt: '2026-09-12T18:30:00.000Z',
        },
      ],
      topMisses: [
        {
          barcode: '999999999999',
          missCount: 4,
          lastQueriedAt: '2026-09-12T18:45:00.000Z',
        },
      ],
    };

    const parsed = barcodeApiStatsSchema.parse(fullStats);
    expect(parsed.summary.totalCalls).toBe(100);
    expect(parsed.providers['upcitemdb']?.state).toBe('healthy');
  });
});
