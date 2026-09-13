import prismaPkg from '@prisma/client';
const { Prisma: PrismaRuntime } = prismaPkg;
import type { Prisma } from '@prisma/client';
import {
  type BarcodeApiStats,
  type BarcodeApiRequestsQuery,
  type BarcodeApiRequestsList,
  type BarcodeApiCallLogRow,
  type BarcodeApiCallLogDetail,
  type BarcodeProviderStats,
  type BarcodeTimelineBucket,
  type TopBarcode,
  type TopMiss,
  encodeCursor,
  decodeCursor,
} from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import {
  getBarcodeProviderSettings,
  getTodayDispatchedCount,
  isProviderCooldownActive,
} from '../external/barcode-provider-settings.js';
import { getBreaker } from '../external/breakers.js';

function getRangeCutoff(range: '24h' | '7d' | '30d'): { cutoff: Date; bucketUnit: 'hour' | 'day' } {
  const now = Date.now();
  switch (range) {
    case '7d':
      return { cutoff: new Date(now - 7 * 24 * 60 * 60 * 1000), bucketUnit: 'day' };
    case '30d':
      return { cutoff: new Date(now - 30 * 24 * 60 * 60 * 1000), bucketUnit: 'day' };
    case '24h':
    default:
      return { cutoff: new Date(now - 24 * 60 * 60 * 1000), bucketUnit: 'hour' };
  }
}

interface RawSummaryRow {
  total_calls: number | bigint;
  hit_count: number | bigint;
  miss_count: number | bigint;
  error_count: number | bigint;
  rate_limited_count: number | bigint;
  timeout_count: number | bigint;
  cooldown_skipped_count: number | bigint;
  avg_duration_ms: number | string | null;
  p95_duration_ms: number | string | null;
}

interface RawProviderRow {
  provider: string;
  total_calls: number | bigint;
  hit_count: number | bigint;
  miss_count: number | bigint;
  error_count: number | bigint;
  rate_limited_count: number | bigint;
  timeout_count: number | bigint;
  min_duration_ms: number | string | null;
  avg_duration_ms: number | string | null;
  p50_duration_ms: number | string | null;
  p95_duration_ms: number | string | null;
  p99_duration_ms: number | string | null;
  max_duration_ms: number | string | null;
}

interface RawTimelineRow {
  bucket: Date;
  provider: string;
  total: number | bigint;
  hits: number | bigint;
  misses: number | bigint;
  errors: number | bigint;
  rate_limited: number | bigint;
  timeouts: number | bigint;
}

interface RawTopBarcodeRow {
  barcode: string;
  total_calls: number | bigint;
  hit_count: number | bigint;
  miss_count: number | bigint;
  last_queried_at: Date;
}

interface RawTopMissRow {
  barcode: string;
  miss_count: number | bigint;
  last_queried_at: Date;
}

export async function getBarcodeApiStats(range: '24h' | '7d' | '30d'): Promise<BarcodeApiStats> {
  const prisma = getPrisma();
  const { cutoff, bucketUnit } = getRangeCutoff(range);
  const config = await getBarcodeProviderSettings();

  // 1. Global summary (excluding probe tests from organic KPIs)
  const summaryRows = await prisma.$queryRaw<RawSummaryRow[]>`
    SELECT
      COUNT(*)::int as total_calls,
      COUNT(*) FILTER (WHERE status = 'hit')::int as hit_count,
      COUNT(*) FILTER (WHERE status = 'miss')::int as miss_count,
      COUNT(*) FILTER (WHERE status = 'error')::int as error_count,
      COUNT(*) FILTER (WHERE status = 'rate_limited')::int as rate_limited_count,
      COUNT(*) FILTER (WHERE status = 'timeout')::int as timeout_count,
      COUNT(*) FILTER (WHERE status = 'cooldown_skipped')::int as cooldown_skipped_count,
      COALESCE(AVG(duration_ms) FILTER (WHERE status != 'cooldown_skipped'), 0)::float as avg_duration_ms,
      COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE status != 'cooldown_skipped'), 0)::float as p95_duration_ms
    FROM barcode_api_call_logs
    WHERE created_at >= ${cutoff} AND caller_context != 'admin_probe'
  `;

  const rawSummary = summaryRows[0] ?? {
    total_calls: 0,
    hit_count: 0,
    miss_count: 0,
    error_count: 0,
    rate_limited_count: 0,
    timeout_count: 0,
    cooldown_skipped_count: 0,
    avg_duration_ms: 0,
    p95_duration_ms: 0,
  };

  const totalCalls = Number(rawSummary.total_calls);
  const hitCount = Number(rawSummary.hit_count);
  const missCount = Number(rawSummary.miss_count);
  const errorCount = Number(rawSummary.error_count);
  const rateLimitedCount = Number(rawSummary.rate_limited_count);
  const timeoutCount = Number(rawSummary.timeout_count);
  const cooldownSkippedCount = Number(rawSummary.cooldown_skipped_count);
  const hitRatePercent = totalCalls > 0 ? Math.round((hitCount / totalCalls) * 1000) / 10 : 0;
  const errorRatePercent = totalCalls > 0 ? Math.round(((errorCount + timeoutCount) / totalCalls) * 1000) / 10 : 0;
  const avgDurationMs = Math.round(Number(rawSummary.avg_duration_ms || 0));
  const p95DurationMs = Math.round(Number(rawSummary.p95_duration_ms || 0));

  // 2. Per-provider stats
  const providerRows = await prisma.$queryRaw<RawProviderRow[]>`
    SELECT
      provider,
      COUNT(*)::int as total_calls,
      COUNT(*) FILTER (WHERE status = 'hit')::int as hit_count,
      COUNT(*) FILTER (WHERE status = 'miss')::int as miss_count,
      COUNT(*) FILTER (WHERE status = 'error')::int as error_count,
      COUNT(*) FILTER (WHERE status = 'rate_limited')::int as rate_limited_count,
      COUNT(*) FILTER (WHERE status = 'timeout')::int as timeout_count,
      COALESCE(MIN(duration_ms) FILTER (WHERE status != 'cooldown_skipped'), 0)::float as min_duration_ms,
      COALESCE(AVG(duration_ms) FILTER (WHERE status != 'cooldown_skipped'), 0)::float as avg_duration_ms,
      COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE status != 'cooldown_skipped'), 0)::float as p50_duration_ms,
      COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE status != 'cooldown_skipped'), 0)::float as p95_duration_ms,
      COALESCE(percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE status != 'cooldown_skipped'), 0)::float as p99_duration_ms,
      COALESCE(MAX(duration_ms) FILTER (WHERE status != 'cooldown_skipped'), 0)::float as max_duration_ms
    FROM barcode_api_call_logs
    WHERE created_at >= ${cutoff} AND caller_context != 'admin_probe'
    GROUP BY provider
  `;

  const providerRowMap = new Map<string, RawProviderRow>();
  for (const r of providerRows) {
    providerRowMap.set(r.provider, r);
  }

  // Ensure all configured providers appear even with 0 calls
  const allProviderKeys = Array.from(new Set([...Object.keys(config.providers), ...providerRowMap.keys()]));
  const providersResult: Record<string, BarcodeProviderStats> = {};

  for (const pKey of allProviderKeys) {
    const pConfig = config.providers[pKey] ?? {
      enabled: true,
      timeoutMs: 3000,
      dailyLimit: null,
      priority: 10,
    };
    const pRow = providerRowMap.get(pKey);

    const pTotal = Number(pRow?.total_calls || 0);
    const pHits = Number(pRow?.hit_count || 0);
    const pMisses = Number(pRow?.miss_count || 0);
    const pErrors = Number(pRow?.error_count || 0);
    const pRateLimited = Number(pRow?.rate_limited_count || 0);
    const pTimeouts = Number(pRow?.timeout_count || 0);
    const pHitRate = pTotal > 0 ? Math.round((pHits / pTotal) * 1000) / 10 : 0;
    const pErrorRate = pTotal > 0 ? Math.round(((pErrors + pTimeouts) / pTotal) * 1000) / 10 : 0;

    const todayCount = await getTodayDispatchedCount(pKey);
    const dailyLimit = pConfig.dailyLimit;
    const quotaRemaining = dailyLimit !== null ? Math.max(0, dailyLimit - todayCount) : null;
    const quotaPercentage =
      dailyLimit !== null && dailyLimit > 0 ? Math.min(100, Math.round((todayCount / dailyLimit) * 100)) : null;

    let breakerState: 'closed' | 'open' | 'halfOpen' = 'closed';
    try {
      const breaker = getBreaker(pKey);
      if (breaker.opened) breakerState = 'open';
      else if (breaker.halfOpen) breakerState = 'halfOpen';
      else breakerState = 'closed';
    } catch {
      breakerState = 'closed';
    }

    const cooldown = isProviderCooldownActive(pKey);

    let state: 'healthy' | 'degraded' | 'open' | 'exhausted' | 'disabled' = 'healthy';
    if (!pConfig.enabled) {
      state = 'disabled';
    } else if (quotaRemaining === 0) {
      state = 'exhausted';
    } else if (breakerState === 'open') {
      state = 'open';
    } else if (pErrorRate > 10 || cooldown.active || breakerState === 'halfOpen') {
      state = 'degraded';
    } else {
      state = 'healthy';
    }

    providersResult[pKey] = {
      name: pKey === 'off' ? 'OpenFoodFacts' : pKey === 'upcitemdb' ? 'UPCitemdb' : pKey,
      enabled: pConfig.enabled,
      dailyLimit,
      todayCallCount: todayCount,
      quotaRemaining,
      quotaPercentage,
      state,
      breakerState,
      cooldownActive: cooldown.active,
      cooldownRemainingSeconds: cooldown.remainingSeconds,
      totalCalls: pTotal,
      hitCount: pHits,
      missCount: pMisses,
      errorCount: pErrors,
      rateLimitedCount: pRateLimited,
      timeoutCount: pTimeouts,
      hitRatePercent: pHitRate,
      errorRatePercent: pErrorRate,
      avgDurationMs: Math.round(Number(pRow?.avg_duration_ms || 0)),
      p50DurationMs: Math.round(Number(pRow?.p50_duration_ms || 0)),
      p95DurationMs: Math.round(Number(pRow?.p95_duration_ms || 0)),
      p99DurationMs: Math.round(Number(pRow?.p99_duration_ms || 0)),
      minDurationMs: Math.round(Number(pRow?.min_duration_ms || 0)),
      maxDurationMs: Math.round(Number(pRow?.max_duration_ms || 0)),
      timeoutMs: pConfig.timeoutMs,
      priority: pConfig.priority,
    };
  }

  // 3. Time-series volume
  const timelineRows =
    bucketUnit === 'hour'
      ? await prisma.$queryRaw<RawTimelineRow[]>`
          SELECT
            date_trunc('hour', created_at) as bucket,
            provider,
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE status = 'hit')::int as hits,
            COUNT(*) FILTER (WHERE status = 'miss')::int as misses,
            COUNT(*) FILTER (WHERE status = 'error')::int as errors,
            COUNT(*) FILTER (WHERE status = 'rate_limited')::int as rate_limited,
            COUNT(*) FILTER (WHERE status = 'timeout')::int as timeouts
          FROM barcode_api_call_logs
          WHERE created_at >= ${cutoff} AND caller_context != 'admin_probe'
          GROUP BY bucket, provider
          ORDER BY bucket ASC
        `
      : await prisma.$queryRaw<RawTimelineRow[]>`
          SELECT
            date_trunc('day', created_at) as bucket,
            provider,
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE status = 'hit')::int as hits,
            COUNT(*) FILTER (WHERE status = 'miss')::int as misses,
            COUNT(*) FILTER (WHERE status = 'error')::int as errors,
            COUNT(*) FILTER (WHERE status = 'rate_limited')::int as rate_limited,
            COUNT(*) FILTER (WHERE status = 'timeout')::int as timeouts
          FROM barcode_api_call_logs
          WHERE created_at >= ${cutoff} AND caller_context != 'admin_probe'
          GROUP BY bucket, provider
          ORDER BY bucket ASC
        `;

  const timelineMap = new Map<string, BarcodeTimelineBucket>();
  for (const tr of timelineRows) {
    const iso = tr.bucket.toISOString();
    let bucket = timelineMap.get(iso);
    if (!bucket) {
      bucket = {
        timestamp: iso,
        total: 0,
        hits: 0,
        misses: 0,
        errors: 0,
        rateLimited: 0,
        timeouts: 0,
        byProvider: {},
      };
      timelineMap.set(iso, bucket);
    }
    const rowTotal = Number(tr.total);
    bucket.total += rowTotal;
    bucket.hits += Number(tr.hits);
    bucket.misses += Number(tr.misses);
    bucket.errors += Number(tr.errors);
    bucket.rateLimited += Number(tr.rate_limited);
    bucket.timeouts += Number(tr.timeouts);
    bucket.byProvider[tr.provider] = (bucket.byProvider[tr.provider] || 0) + rowTotal;
  }

  const volumeTimeline = Array.from(timelineMap.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  // 4. Top queried barcodes
  const topBarcodeRows = await prisma.$queryRaw<RawTopBarcodeRow[]>`
    SELECT
      barcode,
      COUNT(*)::int as total_calls,
      COUNT(*) FILTER (WHERE status = 'hit')::int as hit_count,
      COUNT(*) FILTER (WHERE status = 'miss')::int as miss_count,
      MAX(created_at) as last_queried_at
    FROM barcode_api_call_logs
    WHERE created_at >= ${cutoff} AND caller_context != 'admin_probe'
    GROUP BY barcode
    ORDER BY total_calls DESC
    LIMIT 10
  `;

  const topBarcodes: TopBarcode[] = topBarcodeRows.map((r) => ({
    barcode: r.barcode,
    totalCalls: Number(r.total_calls),
    hitCount: Number(r.hit_count),
    missCount: Number(r.miss_count),
    lastQueriedAt: r.last_queried_at.toISOString(),
  }));

  // 5. Top misses
  const topMissRows = await prisma.$queryRaw<RawTopMissRow[]>`
    SELECT
      barcode,
      COUNT(*)::int as miss_count,
      MAX(created_at) as last_queried_at
    FROM barcode_api_call_logs
    WHERE created_at >= ${cutoff} AND status = 'miss' AND caller_context != 'admin_probe'
    GROUP BY barcode
    ORDER BY miss_count DESC
    LIMIT 10
  `;

  const topMisses: TopMiss[] = topMissRows.map((r) => ({
    barcode: r.barcode,
    missCount: Number(r.miss_count),
    lastQueriedAt: r.last_queried_at.toISOString(),
  }));

  return {
    range,
    summary: {
      totalCalls,
      hitCount,
      missCount,
      errorCount,
      rateLimitedCount,
      timeoutCount,
      cooldownSkippedCount,
      hitRatePercent,
      errorRatePercent,
      avgDurationMs,
      p95DurationMs,
    },
    providers: providersResult,
    volumeTimeline,
    topBarcodes,
    topMisses,
  };
}

export async function getBarcodeApiRequests(query: BarcodeApiRequestsQuery): Promise<BarcodeApiRequestsList> {
  const prisma = getPrisma();
  const limit = Math.min(query.limit ?? 50, 100);
  const { cutoff } = getRangeCutoff(query.range);

  const decoded = decodeCursor(query.cursor);

  const where: Prisma.BarcodeApiCallLogWhereInput = {
    createdAt: { gte: cutoff },
  };

  if (query.provider) {
    where.provider = query.provider;
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.barcode) {
    where.barcode = { contains: query.barcode.trim() };
  }
  if (query.callerContext) {
    where.callerContext = query.callerContext;
  }

  if (decoded) {
    where.OR = [
      { createdAt: { lt: decoded.t } },
      { createdAt: decoded.t, id: { lt: decoded.i } },
    ];
  }

  const rows = await prisma.barcodeApiCallLog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: {
      id: true,
      provider: true,
      barcode: true,
      endpoint: true,
      httpMethod: true,
      status: true,
      httpStatus: true,
      durationMs: true,
      errorMessage: true,
      responseSizeBytes: true,
      callerContext: true,
      userId: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, -1) : rows;

  const nextCursor =
    hasMore && items.length > 0
      ? encodeCursor(items[items.length - 1]!.createdAt, items[items.length - 1]!.id)
      : null;

  const mappedItems: BarcodeApiCallLogRow[] = items.map((r) => ({
    id: r.id,
    provider: r.provider,
    barcode: r.barcode,
    endpoint: r.endpoint,
    httpMethod: r.httpMethod,
    status: r.status as BarcodeApiCallLogRow['status'],
    httpStatus: r.httpStatus,
    durationMs: r.durationMs,
    errorMessage: r.errorMessage,
    responseSizeBytes: r.responseSizeBytes,
    callerContext: r.callerContext as BarcodeApiCallLogRow['callerContext'],
    userId: r.userId,
    createdAt: r.createdAt.toISOString(),
  }));

  return {
    items: mappedItems,
    nextCursor,
  };
}

export async function getBarcodeApiRequestDetail(id: string): Promise<BarcodeApiCallLogDetail | null> {
  const prisma = getPrisma();
  const row = await prisma.barcodeApiCallLog.findUnique({
    where: { id },
  });
  if (!row) return null;

  return {
    id: row.id,
    provider: row.provider,
    barcode: row.barcode,
    endpoint: row.endpoint,
    httpMethod: row.httpMethod,
    status: row.status as BarcodeApiCallLogDetail['status'],
    httpStatus: row.httpStatus,
    durationMs: row.durationMs,
    errorMessage: row.errorMessage,
    responseSizeBytes: row.responseSizeBytes,
    callerContext: row.callerContext as BarcodeApiCallLogDetail['callerContext'],
    requestHeaders: row.requestHeaders ? (row.requestHeaders as Record<string, unknown>) : null,
    responseHeaders: row.responseHeaders ? (row.responseHeaders as Record<string, unknown>) : null,
    rawResponsePreview: row.rawResponsePreview,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
  };
}
