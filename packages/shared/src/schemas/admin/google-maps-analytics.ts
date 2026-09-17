import { z } from 'zod';

export const googleMapsTimeRangeSchema = z.enum(['24h', '7d', '30d']).default('7d');
export type GoogleMapsTimeRange = z.infer<typeof googleMapsTimeRangeSchema>;

export const googleMapsAnalyticsQuerySchema = z.object({
  timeRange: googleMapsTimeRangeSchema,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['all', 'success', 'cached', 'error']).default('all'),
});
export type GoogleMapsAnalyticsQuery = z.infer<typeof googleMapsAnalyticsQuerySchema>;

export const googleMapsLogItemSchema = z.object({
  id: z.string().uuid(),
  endpoint: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  status: z.string(),
  httpStatus: z.number().nullable(),
  durationMs: z.number(),
  formattedAddress: z.string().nullable(),
  countryCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  callerContext: z.string(),
  userId: z.string().uuid().nullable(),
  userEmail: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type GoogleMapsLogItem = z.infer<typeof googleMapsLogItemSchema>;

export const googleMapsVolumePointSchema = z.object({
  date: z.string(),
  total: z.number(),
  success: z.number(),
  cached: z.number(),
  error: z.number(),
});
export type GoogleMapsVolumePoint = z.infer<typeof googleMapsVolumePointSchema>;

export const googleMapsSummarySchema = z.object({
  timeRange: googleMapsTimeRangeSchema,
  todayRequests: z.number(),
  dailyQuotaLimit: z.number(), // 1,000
  dailyQuotaPercentage: z.number(),
  monthlyRequests: z.number(),
  monthlyFreeTierLimit: z.number(), // 40,000
  estimatedCostUsd: z.number(),
  totalRequestsInRange: z.number(),
  cacheHitCount: z.number(),
  cacheHitRatio: z.number(),
  errorCount: z.number(),
  avgDurationMs: z.number(),
  p95DurationMs: z.number(),
  alertLevel: z.enum(['normal', 'warning', 'critical']),
  volumeSeries: z.array(googleMapsVolumePointSchema),
  logs: z.array(googleMapsLogItemSchema),
  totalLogs: z.number(),
  page: z.number(),
  totalPages: z.number(),
});
export type GoogleMapsSummary = z.infer<typeof googleMapsSummarySchema>;

export const googleMapsProbeRequestSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type GoogleMapsProbeRequest = z.infer<typeof googleMapsProbeRequestSchema>;

export const googleMapsProbeResponseSchema = z.object({
  formattedAddress: z.string(),
  countryCode: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  durationMs: z.number(),
  cached: z.boolean(),
});
export type GoogleMapsProbeResponse = z.infer<typeof googleMapsProbeResponseSchema>;
