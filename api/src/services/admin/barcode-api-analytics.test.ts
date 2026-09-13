import { describe, expect, it, beforeEach } from 'vitest';
import {
  getBarcodeApiStats,
  getBarcodeApiRequests,
  getBarcodeApiRequestDetail,
} from './barcode-api-analytics.js';
import { getPrisma } from '../../db.js';

describe('barcode-api-analytics', () => {
  beforeEach(async () => {
    const prisma = getPrisma();
    await prisma.barcodeApiCallLog.deleteMany({});
  });

  it('aggregates summary KPIs and percentiles while strictly isolating admin_probe calls', async () => {
    const prisma = getPrisma();

    // Seed 4 organic user calls
    await prisma.barcodeApiCallLog.createMany({
      data: [
        {
          provider: 'off',
          barcode: '5449000000996',
          endpoint: 'https://world.openfoodfacts.org/api/v2/product/5449000000996.json',
          httpMethod: 'GET',
          status: 'hit',
          httpStatus: 200,
          durationMs: 100,
          callerContext: 'sync_lookup',
        },
        {
          provider: 'off',
          barcode: '5449000000996',
          endpoint: 'https://world.openfoodfacts.org/api/v2/product/5449000000996.json',
          httpMethod: 'GET',
          status: 'hit',
          httpStatus: 200,
          durationMs: 200,
          callerContext: 'sync_lookup',
        },
        {
          provider: 'upcitemdb',
          barcode: '000000000000',
          endpoint: 'https://api.upcitemdb.com/prod/trial/lookup',
          httpMethod: 'GET',
          status: 'miss',
          httpStatus: 404,
          durationMs: 300,
          callerContext: 'sync_lookup',
        },
        {
          provider: 'upcitemdb',
          barcode: '111111111111',
          endpoint: 'https://api.upcitemdb.com/prod/trial/lookup',
          httpMethod: 'GET',
          status: 'rate_limited',
          httpStatus: 429,
          durationMs: 400,
          callerContext: 'sync_lookup',
        },
        // Seed 1 admin probe test call (MUST BE FILTERED OUT FROM ORGANIC METRICS)
        {
          provider: 'off',
          barcode: '999999999999',
          endpoint: 'https://world.openfoodfacts.org/api/v2/product/999999999999.json',
          httpMethod: 'GET',
          status: 'error',
          httpStatus: 500,
          durationMs: 5000,
          callerContext: 'admin_probe',
        },
      ],
    });

    const stats = await getBarcodeApiStats('24h');

    // Total organic calls must be 4, NOT 5!
    expect(stats.summary.totalCalls).toBe(4);
    expect(stats.summary.hitCount).toBe(2);
    expect(stats.summary.missCount).toBe(1);
    expect(stats.summary.rateLimitedCount).toBe(1);
    expect(stats.summary.errorCount).toBe(0); // The 500 was an admin_probe, so excluded!
    expect(stats.summary.hitRatePercent).toBe(50); // 2 out of 4 = 50%

    // Latency must reflect only organic calls (100, 200, 300, 400 -> avg 250ms)
    expect(stats.summary.avgDurationMs).toBe(250);
    expect(stats.summary.p95DurationMs).toBeGreaterThan(300);

    // Top barcodes should have Coca-Cola on top with 2 calls
    expect(stats.topBarcodes.length).toBeGreaterThan(0);
    expect(stats.topBarcodes[0]?.barcode).toBe('5449000000996');
    expect(stats.topBarcodes[0]?.totalCalls).toBe(2);

    // Top misses should have 000000000000
    expect(stats.topMisses.length).toBe(1);
    expect(stats.topMisses[0]?.barcode).toBe('000000000000');
  });

  it('filters and paginates request logs via getBarcodeApiRequests', async () => {
    const prisma = getPrisma();

    await prisma.barcodeApiCallLog.createMany({
      data: [
        {
          provider: 'off',
          barcode: '111111111111',
          endpoint: 'https://example.com/1',
          status: 'hit',
          durationMs: 120,
          callerContext: 'sync_lookup',
        },
        {
          provider: 'upcitemdb',
          barcode: '222222222222',
          endpoint: 'https://example.com/2',
          status: 'miss',
          durationMs: 140,
          callerContext: 'admin_probe',
        },
      ],
    });

    // Query filter by callerContext: admin_probe
    const probeOnly = await getBarcodeApiRequests({
      range: '24h',
      callerContext: 'admin_probe',
      limit: 10,
    });
    expect(probeOnly.items.length).toBe(1);
    expect(probeOnly.items[0]?.barcode).toBe('222222222222');

    // Query filter by status: hit
    const hitsOnly = await getBarcodeApiRequests({
      range: '24h',
      status: 'hit',
      limit: 10,
    });
    expect(hitsOnly.items.length).toBe(1);
    expect(hitsOnly.items[0]?.barcode).toBe('111111111111');
  });

  it('fetches full detail payload via getBarcodeApiRequestDetail', async () => {
    const prisma = getPrisma();

    const created = await prisma.barcodeApiCallLog.create({
      data: {
        provider: 'off',
        barcode: '333333333333',
        endpoint: 'https://world.openfoodfacts.org/api/v2/product/333333333333.json',
        status: 'hit',
        httpStatus: 200,
        durationMs: 185,
        requestHeaders: { 'user-agent': 'PantryApp/1.0' },
        responseHeaders: { 'content-type': 'application/json' },
        rawResponsePreview: '{"status":1}',
      },
    });

    const detail = await getBarcodeApiRequestDetail(created.id);
    expect(detail).not.toBeNull();
    expect(detail?.barcode).toBe('333333333333');
    expect(detail?.requestHeaders).toEqual({ 'user-agent': 'PantryApp/1.0' });
    expect(detail?.rawResponsePreview).toBe('{"status":1}');
  });
});
