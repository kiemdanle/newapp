import { getPrisma } from '../../db.js';
import type {
  GoogleMapsAnalyticsQuery,
  GoogleMapsSummary,
  GoogleMapsVolumePoint,
  GoogleMapsLogItem,
  GoogleMapsProbeResponse,
} from '@expyrico/shared';
import { reverseGeocodeCoordinates } from '../geo/google-maps-geocoder.js';

export async function getGoogleMapsSummary(query: GoogleMapsAnalyticsQuery): Promise<GoogleMapsSummary> {
  const prisma = getPrisma();
  const now = new Date();

  // Time window bounds
  let windowDurationMs = 7 * 24 * 60 * 60 * 1000;
  if (query.timeRange === '24h') windowDurationMs = 24 * 60 * 60 * 1000;
  if (query.timeRange === '30d') windowDurationMs = 30 * 24 * 60 * 60 * 1000;
  const since = new Date(now.getTime() - windowDurationMs);

  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // 1. Quota counts
  const [todayRequests, monthlyRequests] = await Promise.all([
    prisma.googleMapsApiCallLog.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.googleMapsApiCallLog.count({ where: { createdAt: { gte: startOfMonth } } }),
  ]);

  const dailyQuotaLimit = 1000;
  const dailyQuotaPercentage = Math.round((todayRequests / dailyQuotaLimit) * 1000) / 10;
  const alertLevel: 'normal' | 'warning' | 'critical' =
    todayRequests >= 950 ? 'critical' : todayRequests >= 800 ? 'warning' : 'normal';

  const monthlyFreeTierLimit = 40000;
  const estimatedCostUsd =
    monthlyRequests > monthlyFreeTierLimit
      ? Math.round((monthlyRequests - monthlyFreeTierLimit) * 0.005 * 100) / 100
      : 0;

  // 2. Aggregate metrics within time range
  const whereRange = { createdAt: { gte: since } };
  const statusFilter = query.status !== 'all' ? { status: query.status } : {};

  const [totalInRange, cacheHitCount, errorCount, durationAgg, logsCount] = await Promise.all([
    prisma.googleMapsApiCallLog.count({ where: whereRange }),
    prisma.googleMapsApiCallLog.count({ where: { ...whereRange, status: 'cached' } }),
    prisma.googleMapsApiCallLog.count({ where: { ...whereRange, status: { in: ['error', 'rate_limited'] } } }),
    prisma.googleMapsApiCallLog.aggregate({
      where: { ...whereRange, status: 'success' },
      _avg: { durationMs: true },
      _max: { durationMs: true },
    }),
    prisma.googleMapsApiCallLog.count({ where: { ...whereRange, ...statusFilter } }),
  ]);

  const avgDurationMs = Math.round(durationAgg._avg.durationMs ?? 0);
  const p95DurationMs = Math.round(durationAgg._max.durationMs ?? 0);
  const cacheHitRatio = totalInRange > 0 ? Math.round((cacheHitCount / totalInRange) * 1000) / 10 : 0;

  // 3. Paginated logs with user relation
  const skip = (query.page - 1) * query.limit;
  const rawLogs = await prisma.googleMapsApiCallLog.findMany({
    where: { ...whereRange, ...statusFilter },
    orderBy: { createdAt: 'desc' },
    skip,
    take: query.limit,
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  const logs: GoogleMapsLogItem[] = rawLogs.map((log) => ({
    id: log.id,
    endpoint: log.endpoint,
    latitude: log.latitude,
    longitude: log.longitude,
    status: log.status,
    httpStatus: log.httpStatus,
    durationMs: log.durationMs,
    formattedAddress: log.formattedAddress,
    countryCode: log.countryCode,
    errorMessage: log.errorMessage,
    callerContext: log.callerContext,
    userId: log.userId,
    userEmail: log.user?.email || null,
    createdAt: log.createdAt.toISOString(),
  }));

  // 4. Daily Volume Series (bucket by date)
  const days = query.timeRange === '24h' ? 1 : query.timeRange === '7d' ? 7 : 30;
  const volumeMap = new Map<string, { total: number; success: number; cached: number; error: number }>();

  // Pre-fill series with zero counts
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    volumeMap.set(dateStr, { total: 0, success: 0, cached: 0, error: 0 });
  }

  // Fetch points from database
  const points = await prisma.googleMapsApiCallLog.findMany({
    where: whereRange,
    select: { createdAt: true, status: true },
  });

  for (const pt of points) {
    const dateStr = pt.createdAt.toISOString().slice(0, 10);
    const entry = volumeMap.get(dateStr);
    if (entry) {
      entry.total += 1;
      if (pt.status === 'success') entry.success += 1;
      else if (pt.status === 'cached') entry.cached += 1;
      else entry.error += 1;
    }
  }

  const volumeSeries: GoogleMapsVolumePoint[] = Array.from(volumeMap.entries()).map(([date, counts]) => ({
    date,
    total: counts.total,
    success: counts.success,
    cached: counts.cached,
    error: counts.error,
  }));

  const totalPages = Math.max(1, Math.ceil(logsCount / query.limit));

  return {
    timeRange: query.timeRange,
    todayRequests,
    dailyQuotaLimit,
    dailyQuotaPercentage,
    monthlyRequests,
    monthlyFreeTierLimit,
    estimatedCostUsd,
    totalRequestsInRange: totalInRange,
    cacheHitCount,
    cacheHitRatio,
    errorCount,
    avgDurationMs,
    p95DurationMs,
    alertLevel,
    volumeSeries,
    logs,
    totalLogs: logsCount,
    page: query.page,
    totalPages,
  };
}

export async function probeGoogleMapsCoordinates(
  latitude: number,
  longitude: number,
  adminUserId: string,
): Promise<GoogleMapsProbeResponse> {
  const start = performance.now();
  const result = await reverseGeocodeCoordinates(latitude, longitude, adminUserId, 'admin_probe');
  const durationMs = Math.round(performance.now() - start);

  return {
    formattedAddress: result.address,
    countryCode: result.countryCode,
    latitude: result.latitude,
    longitude: result.longitude,
    durationMs,
    cached: result.cached,
  };
}
