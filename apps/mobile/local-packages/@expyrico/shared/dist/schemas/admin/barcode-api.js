import { z } from 'zod';
import { cursorQuerySchema, cursorPageSchema } from './common.js';
export const barcodeApiStatusSchema = z.enum([
    'hit',
    'miss',
    'rate_limited',
    'timeout',
    'error',
    'cooldown_skipped',
]);
export const barcodeApiCallerContextSchema = z.enum([
    'sync_lookup',
    'backfill_worker',
    'admin_probe',
]);
export const barcodeApiCallLogRowSchema = z.object({
    id: z.string().uuid(),
    provider: z.string(),
    barcode: z.string(),
    endpoint: z.string(),
    httpMethod: z.string(),
    status: barcodeApiStatusSchema,
    httpStatus: z.number().int().nullable(),
    durationMs: z.number().int(),
    errorMessage: z.string().nullable(),
    responseSizeBytes: z.number().int().nullable(),
    callerContext: barcodeApiCallerContextSchema,
    userId: z.string().uuid().nullable(),
    createdAt: z.string().datetime(),
});
export const barcodeApiCallLogDetailSchema = barcodeApiCallLogRowSchema.extend({
    requestHeaders: z.record(z.string(), z.unknown()).nullable(),
    responseHeaders: z.record(z.string(), z.unknown()).nullable(),
    rawResponsePreview: z.string().nullable(),
});
export const barcodeApiRequestsQuerySchema = cursorQuerySchema.extend({
    provider: z.string().optional(),
    status: barcodeApiStatusSchema.optional(),
    barcode: z.string().optional(),
    callerContext: barcodeApiCallerContextSchema.optional(),
    range: z.enum(['24h', '7d', '30d']).default('24h'),
});
export const barcodeApiRequestsListSchema = cursorPageSchema(barcodeApiCallLogRowSchema);
export const barcodeProviderStatsSchema = z.object({
    name: z.string(),
    enabled: z.boolean(),
    dailyLimit: z.number().int().positive().nullable(),
    todayCallCount: z.number().int(),
    quotaRemaining: z.number().int().nullable(),
    quotaPercentage: z.number().nullable(),
    state: z.enum(['healthy', 'degraded', 'open', 'exhausted', 'disabled']),
    breakerState: z.enum(['closed', 'open', 'halfOpen']),
    cooldownActive: z.boolean(),
    cooldownRemainingSeconds: z.number().int().nullable(),
    totalCalls: z.number().int(),
    hitCount: z.number().int(),
    missCount: z.number().int(),
    errorCount: z.number().int(),
    rateLimitedCount: z.number().int(),
    timeoutCount: z.number().int(),
    hitRatePercent: z.number(),
    errorRatePercent: z.number(),
    avgDurationMs: z.number(),
    p50DurationMs: z.number(),
    p95DurationMs: z.number(),
    p99DurationMs: z.number(),
    minDurationMs: z.number(),
    maxDurationMs: z.number(),
    timeoutMs: z.number().int(),
    priority: z.number().int(),
});
export const barcodeTimelineBucketSchema = z.object({
    timestamp: z.string().datetime(),
    total: z.number().int(),
    hits: z.number().int(),
    misses: z.number().int(),
    errors: z.number().int(),
    rateLimited: z.number().int(),
    timeouts: z.number().int(),
    byProvider: z.record(z.string(), z.number().int()),
});
export const topBarcodeSchema = z.object({
    barcode: z.string(),
    totalCalls: z.number().int(),
    hitCount: z.number().int(),
    missCount: z.number().int(),
    lastQueriedAt: z.string().datetime(),
});
export const topMissSchema = z.object({
    barcode: z.string(),
    missCount: z.number().int(),
    lastQueriedAt: z.string().datetime(),
});
export const barcodeApiStatsSchema = z.object({
    range: z.enum(['24h', '7d', '30d']),
    summary: z.object({
        totalCalls: z.number().int(),
        hitCount: z.number().int(),
        missCount: z.number().int(),
        errorCount: z.number().int(),
        rateLimitedCount: z.number().int(),
        timeoutCount: z.number().int(),
        cooldownSkippedCount: z.number().int(),
        hitRatePercent: z.number(),
        errorRatePercent: z.number(),
        avgDurationMs: z.number(),
        p95DurationMs: z.number(),
    }),
    providers: z.record(z.string(), barcodeProviderStatsSchema),
    volumeTimeline: z.array(barcodeTimelineBucketSchema),
    topBarcodes: z.array(topBarcodeSchema),
    topMisses: z.array(topMissSchema),
});
export const barcodeProviderSettingSchema = z.object({
    enabled: z.boolean().default(true),
    timeoutMs: z.number().int().min(500).max(30000).default(3000),
    dailyLimit: z.number().int().positive().nullable().default(null),
    priority: z.number().int().min(1).max(100).default(10),
});
export const barcodeProviderSettingPatchSchema = z.object({
    enabled: z.boolean().optional(),
    timeoutMs: z.number().int().min(500).max(30000).optional(),
    dailyLimit: z.number().int().positive().nullable().optional(),
    priority: z.number().int().min(1).max(100).optional(),
});
export const barcodeApiConfigSchema = z.object({
    providers: z.record(z.string(), barcodeProviderSettingSchema),
    retentionDays: z.number().int().min(7).nullable().default(30),
});
// Notice: retentionDays is optional with NO default so partial PATCH does not overwrite null with 30
export const barcodeApiConfigPatchSchema = z.object({
    providers: z.record(z.string(), barcodeProviderSettingPatchSchema).optional(),
    retentionDays: z.number().int().min(7).nullable().optional(),
});
export const barcodeApiProbeRequestSchema = z.object({
    barcode: z.string().min(1).max(64),
    provider: z.string().min(1).max(64),
});
export const barcodeApiProbeResponseSchema = z.object({
    provider: z.string(),
    barcode: z.string(),
    endpoint: z.string(),
    durationMs: z.number().int(),
    httpStatus: z.number().int().nullable(),
    status: barcodeApiStatusSchema,
    headers: z.record(z.string(), z.string()).optional(),
    parsedProduct: z
        .object({
        name: z.string().nullable().optional(),
        brand: z.string().nullable().optional(),
        found: z.boolean(),
    })
        .optional(),
    rawResponsePreview: z.string().nullable().optional(),
    errorMessage: z.string().nullable().optional(),
});
export const barcodeApiResetActionSchema = z.object({
    provider: z.string(),
    target: z.enum(['cooldown', 'breaker', 'all']),
});
//# sourceMappingURL=barcode-api.js.map