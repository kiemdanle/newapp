import { z } from 'zod';
export declare const barcodeApiStatusSchema: z.ZodEnum<["hit", "miss", "rate_limited", "timeout", "error", "cooldown_skipped"]>;
export declare const barcodeApiCallerContextSchema: z.ZodEnum<["sync_lookup", "backfill_worker", "admin_probe"]>;
export declare const barcodeApiCallLogRowSchema: z.ZodObject<{
    id: z.ZodString;
    provider: z.ZodString;
    barcode: z.ZodString;
    endpoint: z.ZodString;
    httpMethod: z.ZodString;
    status: z.ZodEnum<["hit", "miss", "rate_limited", "timeout", "error", "cooldown_skipped"]>;
    httpStatus: z.ZodNullable<z.ZodNumber>;
    durationMs: z.ZodNumber;
    errorMessage: z.ZodNullable<z.ZodString>;
    responseSizeBytes: z.ZodNullable<z.ZodNumber>;
    callerContext: z.ZodEnum<["sync_lookup", "backfill_worker", "admin_probe"]>;
    userId: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "rate_limited" | "hit" | "miss" | "timeout" | "error" | "cooldown_skipped";
    createdAt: string;
    barcode: string;
    userId: string | null;
    errorMessage: string | null;
    provider: string;
    endpoint: string;
    httpMethod: string;
    httpStatus: number | null;
    durationMs: number;
    responseSizeBytes: number | null;
    callerContext: "sync_lookup" | "backfill_worker" | "admin_probe";
}, {
    id: string;
    status: "rate_limited" | "hit" | "miss" | "timeout" | "error" | "cooldown_skipped";
    createdAt: string;
    barcode: string;
    userId: string | null;
    errorMessage: string | null;
    provider: string;
    endpoint: string;
    httpMethod: string;
    httpStatus: number | null;
    durationMs: number;
    responseSizeBytes: number | null;
    callerContext: "sync_lookup" | "backfill_worker" | "admin_probe";
}>;
export declare const barcodeApiCallLogDetailSchema: z.ZodObject<{
    id: z.ZodString;
    provider: z.ZodString;
    barcode: z.ZodString;
    endpoint: z.ZodString;
    httpMethod: z.ZodString;
    status: z.ZodEnum<["hit", "miss", "rate_limited", "timeout", "error", "cooldown_skipped"]>;
    httpStatus: z.ZodNullable<z.ZodNumber>;
    durationMs: z.ZodNumber;
    errorMessage: z.ZodNullable<z.ZodString>;
    responseSizeBytes: z.ZodNullable<z.ZodNumber>;
    callerContext: z.ZodEnum<["sync_lookup", "backfill_worker", "admin_probe"]>;
    userId: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
} & {
    requestHeaders: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    responseHeaders: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    rawResponsePreview: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "rate_limited" | "hit" | "miss" | "timeout" | "error" | "cooldown_skipped";
    createdAt: string;
    barcode: string;
    userId: string | null;
    errorMessage: string | null;
    provider: string;
    endpoint: string;
    httpMethod: string;
    httpStatus: number | null;
    durationMs: number;
    responseSizeBytes: number | null;
    callerContext: "sync_lookup" | "backfill_worker" | "admin_probe";
    requestHeaders: Record<string, unknown> | null;
    responseHeaders: Record<string, unknown> | null;
    rawResponsePreview: string | null;
}, {
    id: string;
    status: "rate_limited" | "hit" | "miss" | "timeout" | "error" | "cooldown_skipped";
    createdAt: string;
    barcode: string;
    userId: string | null;
    errorMessage: string | null;
    provider: string;
    endpoint: string;
    httpMethod: string;
    httpStatus: number | null;
    durationMs: number;
    responseSizeBytes: number | null;
    callerContext: "sync_lookup" | "backfill_worker" | "admin_probe";
    requestHeaders: Record<string, unknown> | null;
    responseHeaders: Record<string, unknown> | null;
    rawResponsePreview: string | null;
}>;
export declare const barcodeApiRequestsQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
} & {
    provider: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["hit", "miss", "rate_limited", "timeout", "error", "cooldown_skipped"]>>;
    barcode: z.ZodOptional<z.ZodString>;
    callerContext: z.ZodOptional<z.ZodEnum<["sync_lookup", "backfill_worker", "admin_probe"]>>;
    range: z.ZodDefault<z.ZodEnum<["24h", "7d", "30d"]>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    range: "7d" | "30d" | "24h";
    status?: "rate_limited" | "hit" | "miss" | "timeout" | "error" | "cooldown_skipped" | undefined;
    barcode?: string | undefined;
    cursor?: string | undefined;
    provider?: string | undefined;
    callerContext?: "sync_lookup" | "backfill_worker" | "admin_probe" | undefined;
}, {
    status?: "rate_limited" | "hit" | "miss" | "timeout" | "error" | "cooldown_skipped" | undefined;
    barcode?: string | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
    range?: "7d" | "30d" | "24h" | undefined;
    provider?: string | undefined;
    callerContext?: "sync_lookup" | "backfill_worker" | "admin_probe" | undefined;
}>;
export declare const barcodeApiRequestsListSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        provider: z.ZodString;
        barcode: z.ZodString;
        endpoint: z.ZodString;
        httpMethod: z.ZodString;
        status: z.ZodEnum<["hit", "miss", "rate_limited", "timeout", "error", "cooldown_skipped"]>;
        httpStatus: z.ZodNullable<z.ZodNumber>;
        durationMs: z.ZodNumber;
        errorMessage: z.ZodNullable<z.ZodString>;
        responseSizeBytes: z.ZodNullable<z.ZodNumber>;
        callerContext: z.ZodEnum<["sync_lookup", "backfill_worker", "admin_probe"]>;
        userId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "rate_limited" | "hit" | "miss" | "timeout" | "error" | "cooldown_skipped";
        createdAt: string;
        barcode: string;
        userId: string | null;
        errorMessage: string | null;
        provider: string;
        endpoint: string;
        httpMethod: string;
        httpStatus: number | null;
        durationMs: number;
        responseSizeBytes: number | null;
        callerContext: "sync_lookup" | "backfill_worker" | "admin_probe";
    }, {
        id: string;
        status: "rate_limited" | "hit" | "miss" | "timeout" | "error" | "cooldown_skipped";
        createdAt: string;
        barcode: string;
        userId: string | null;
        errorMessage: string | null;
        provider: string;
        endpoint: string;
        httpMethod: string;
        httpStatus: number | null;
        durationMs: number;
        responseSizeBytes: number | null;
        callerContext: "sync_lookup" | "backfill_worker" | "admin_probe";
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        status: "rate_limited" | "hit" | "miss" | "timeout" | "error" | "cooldown_skipped";
        createdAt: string;
        barcode: string;
        userId: string | null;
        errorMessage: string | null;
        provider: string;
        endpoint: string;
        httpMethod: string;
        httpStatus: number | null;
        durationMs: number;
        responseSizeBytes: number | null;
        callerContext: "sync_lookup" | "backfill_worker" | "admin_probe";
    }[];
    nextCursor: string | null;
}, {
    items: {
        id: string;
        status: "rate_limited" | "hit" | "miss" | "timeout" | "error" | "cooldown_skipped";
        createdAt: string;
        barcode: string;
        userId: string | null;
        errorMessage: string | null;
        provider: string;
        endpoint: string;
        httpMethod: string;
        httpStatus: number | null;
        durationMs: number;
        responseSizeBytes: number | null;
        callerContext: "sync_lookup" | "backfill_worker" | "admin_probe";
    }[];
    nextCursor: string | null;
}>;
export declare const barcodeProviderStatsSchema: z.ZodObject<{
    name: z.ZodString;
    enabled: z.ZodBoolean;
    dailyLimit: z.ZodNullable<z.ZodNumber>;
    todayCallCount: z.ZodNumber;
    quotaRemaining: z.ZodNullable<z.ZodNumber>;
    quotaPercentage: z.ZodNullable<z.ZodNumber>;
    state: z.ZodEnum<["healthy", "degraded", "open", "exhausted", "disabled"]>;
    breakerState: z.ZodEnum<["closed", "open", "halfOpen"]>;
    cooldownActive: z.ZodBoolean;
    cooldownRemainingSeconds: z.ZodNullable<z.ZodNumber>;
    totalCalls: z.ZodNumber;
    hitCount: z.ZodNumber;
    missCount: z.ZodNumber;
    errorCount: z.ZodNumber;
    rateLimitedCount: z.ZodNumber;
    timeoutCount: z.ZodNumber;
    hitRatePercent: z.ZodNumber;
    errorRatePercent: z.ZodNumber;
    avgDurationMs: z.ZodNumber;
    p50DurationMs: z.ZodNumber;
    p95DurationMs: z.ZodNumber;
    p99DurationMs: z.ZodNumber;
    minDurationMs: z.ZodNumber;
    maxDurationMs: z.ZodNumber;
    timeoutMs: z.ZodNumber;
    priority: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    state: "open" | "healthy" | "degraded" | "exhausted" | "disabled";
    enabled: boolean;
    dailyLimit: number | null;
    todayCallCount: number;
    quotaRemaining: number | null;
    quotaPercentage: number | null;
    breakerState: "open" | "closed" | "halfOpen";
    cooldownActive: boolean;
    cooldownRemainingSeconds: number | null;
    totalCalls: number;
    hitCount: number;
    missCount: number;
    errorCount: number;
    rateLimitedCount: number;
    timeoutCount: number;
    hitRatePercent: number;
    errorRatePercent: number;
    avgDurationMs: number;
    p50DurationMs: number;
    p95DurationMs: number;
    p99DurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    timeoutMs: number;
    priority: number;
}, {
    name: string;
    state: "open" | "healthy" | "degraded" | "exhausted" | "disabled";
    enabled: boolean;
    dailyLimit: number | null;
    todayCallCount: number;
    quotaRemaining: number | null;
    quotaPercentage: number | null;
    breakerState: "open" | "closed" | "halfOpen";
    cooldownActive: boolean;
    cooldownRemainingSeconds: number | null;
    totalCalls: number;
    hitCount: number;
    missCount: number;
    errorCount: number;
    rateLimitedCount: number;
    timeoutCount: number;
    hitRatePercent: number;
    errorRatePercent: number;
    avgDurationMs: number;
    p50DurationMs: number;
    p95DurationMs: number;
    p99DurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    timeoutMs: number;
    priority: number;
}>;
export declare const barcodeTimelineBucketSchema: z.ZodObject<{
    timestamp: z.ZodString;
    total: z.ZodNumber;
    hits: z.ZodNumber;
    misses: z.ZodNumber;
    errors: z.ZodNumber;
    rateLimited: z.ZodNumber;
    timeouts: z.ZodNumber;
    byProvider: z.ZodRecord<z.ZodString, z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    errors: number;
    total: number;
    timestamp: string;
    hits: number;
    misses: number;
    rateLimited: number;
    timeouts: number;
    byProvider: Record<string, number>;
}, {
    errors: number;
    total: number;
    timestamp: string;
    hits: number;
    misses: number;
    rateLimited: number;
    timeouts: number;
    byProvider: Record<string, number>;
}>;
export declare const topBarcodeSchema: z.ZodObject<{
    barcode: z.ZodString;
    totalCalls: z.ZodNumber;
    hitCount: z.ZodNumber;
    missCount: z.ZodNumber;
    lastQueriedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    barcode: string;
    totalCalls: number;
    hitCount: number;
    missCount: number;
    lastQueriedAt: string;
}, {
    barcode: string;
    totalCalls: number;
    hitCount: number;
    missCount: number;
    lastQueriedAt: string;
}>;
export declare const topMissSchema: z.ZodObject<{
    barcode: z.ZodString;
    missCount: z.ZodNumber;
    lastQueriedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    barcode: string;
    missCount: number;
    lastQueriedAt: string;
}, {
    barcode: string;
    missCount: number;
    lastQueriedAt: string;
}>;
export declare const barcodeApiStatsSchema: z.ZodObject<{
    range: z.ZodEnum<["24h", "7d", "30d"]>;
    summary: z.ZodObject<{
        totalCalls: z.ZodNumber;
        hitCount: z.ZodNumber;
        missCount: z.ZodNumber;
        errorCount: z.ZodNumber;
        rateLimitedCount: z.ZodNumber;
        timeoutCount: z.ZodNumber;
        cooldownSkippedCount: z.ZodNumber;
        hitRatePercent: z.ZodNumber;
        errorRatePercent: z.ZodNumber;
        avgDurationMs: z.ZodNumber;
        p95DurationMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalCalls: number;
        hitCount: number;
        missCount: number;
        errorCount: number;
        rateLimitedCount: number;
        timeoutCount: number;
        hitRatePercent: number;
        errorRatePercent: number;
        avgDurationMs: number;
        p95DurationMs: number;
        cooldownSkippedCount: number;
    }, {
        totalCalls: number;
        hitCount: number;
        missCount: number;
        errorCount: number;
        rateLimitedCount: number;
        timeoutCount: number;
        hitRatePercent: number;
        errorRatePercent: number;
        avgDurationMs: number;
        p95DurationMs: number;
        cooldownSkippedCount: number;
    }>;
    providers: z.ZodRecord<z.ZodString, z.ZodObject<{
        name: z.ZodString;
        enabled: z.ZodBoolean;
        dailyLimit: z.ZodNullable<z.ZodNumber>;
        todayCallCount: z.ZodNumber;
        quotaRemaining: z.ZodNullable<z.ZodNumber>;
        quotaPercentage: z.ZodNullable<z.ZodNumber>;
        state: z.ZodEnum<["healthy", "degraded", "open", "exhausted", "disabled"]>;
        breakerState: z.ZodEnum<["closed", "open", "halfOpen"]>;
        cooldownActive: z.ZodBoolean;
        cooldownRemainingSeconds: z.ZodNullable<z.ZodNumber>;
        totalCalls: z.ZodNumber;
        hitCount: z.ZodNumber;
        missCount: z.ZodNumber;
        errorCount: z.ZodNumber;
        rateLimitedCount: z.ZodNumber;
        timeoutCount: z.ZodNumber;
        hitRatePercent: z.ZodNumber;
        errorRatePercent: z.ZodNumber;
        avgDurationMs: z.ZodNumber;
        p50DurationMs: z.ZodNumber;
        p95DurationMs: z.ZodNumber;
        p99DurationMs: z.ZodNumber;
        minDurationMs: z.ZodNumber;
        maxDurationMs: z.ZodNumber;
        timeoutMs: z.ZodNumber;
        priority: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        state: "open" | "healthy" | "degraded" | "exhausted" | "disabled";
        enabled: boolean;
        dailyLimit: number | null;
        todayCallCount: number;
        quotaRemaining: number | null;
        quotaPercentage: number | null;
        breakerState: "open" | "closed" | "halfOpen";
        cooldownActive: boolean;
        cooldownRemainingSeconds: number | null;
        totalCalls: number;
        hitCount: number;
        missCount: number;
        errorCount: number;
        rateLimitedCount: number;
        timeoutCount: number;
        hitRatePercent: number;
        errorRatePercent: number;
        avgDurationMs: number;
        p50DurationMs: number;
        p95DurationMs: number;
        p99DurationMs: number;
        minDurationMs: number;
        maxDurationMs: number;
        timeoutMs: number;
        priority: number;
    }, {
        name: string;
        state: "open" | "healthy" | "degraded" | "exhausted" | "disabled";
        enabled: boolean;
        dailyLimit: number | null;
        todayCallCount: number;
        quotaRemaining: number | null;
        quotaPercentage: number | null;
        breakerState: "open" | "closed" | "halfOpen";
        cooldownActive: boolean;
        cooldownRemainingSeconds: number | null;
        totalCalls: number;
        hitCount: number;
        missCount: number;
        errorCount: number;
        rateLimitedCount: number;
        timeoutCount: number;
        hitRatePercent: number;
        errorRatePercent: number;
        avgDurationMs: number;
        p50DurationMs: number;
        p95DurationMs: number;
        p99DurationMs: number;
        minDurationMs: number;
        maxDurationMs: number;
        timeoutMs: number;
        priority: number;
    }>>;
    volumeTimeline: z.ZodArray<z.ZodObject<{
        timestamp: z.ZodString;
        total: z.ZodNumber;
        hits: z.ZodNumber;
        misses: z.ZodNumber;
        errors: z.ZodNumber;
        rateLimited: z.ZodNumber;
        timeouts: z.ZodNumber;
        byProvider: z.ZodRecord<z.ZodString, z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        errors: number;
        total: number;
        timestamp: string;
        hits: number;
        misses: number;
        rateLimited: number;
        timeouts: number;
        byProvider: Record<string, number>;
    }, {
        errors: number;
        total: number;
        timestamp: string;
        hits: number;
        misses: number;
        rateLimited: number;
        timeouts: number;
        byProvider: Record<string, number>;
    }>, "many">;
    topBarcodes: z.ZodArray<z.ZodObject<{
        barcode: z.ZodString;
        totalCalls: z.ZodNumber;
        hitCount: z.ZodNumber;
        missCount: z.ZodNumber;
        lastQueriedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        barcode: string;
        totalCalls: number;
        hitCount: number;
        missCount: number;
        lastQueriedAt: string;
    }, {
        barcode: string;
        totalCalls: number;
        hitCount: number;
        missCount: number;
        lastQueriedAt: string;
    }>, "many">;
    topMisses: z.ZodArray<z.ZodObject<{
        barcode: z.ZodString;
        missCount: z.ZodNumber;
        lastQueriedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        barcode: string;
        missCount: number;
        lastQueriedAt: string;
    }, {
        barcode: string;
        missCount: number;
        lastQueriedAt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    range: "7d" | "30d" | "24h";
    summary: {
        totalCalls: number;
        hitCount: number;
        missCount: number;
        errorCount: number;
        rateLimitedCount: number;
        timeoutCount: number;
        hitRatePercent: number;
        errorRatePercent: number;
        avgDurationMs: number;
        p95DurationMs: number;
        cooldownSkippedCount: number;
    };
    providers: Record<string, {
        name: string;
        state: "open" | "healthy" | "degraded" | "exhausted" | "disabled";
        enabled: boolean;
        dailyLimit: number | null;
        todayCallCount: number;
        quotaRemaining: number | null;
        quotaPercentage: number | null;
        breakerState: "open" | "closed" | "halfOpen";
        cooldownActive: boolean;
        cooldownRemainingSeconds: number | null;
        totalCalls: number;
        hitCount: number;
        missCount: number;
        errorCount: number;
        rateLimitedCount: number;
        timeoutCount: number;
        hitRatePercent: number;
        errorRatePercent: number;
        avgDurationMs: number;
        p50DurationMs: number;
        p95DurationMs: number;
        p99DurationMs: number;
        minDurationMs: number;
        maxDurationMs: number;
        timeoutMs: number;
        priority: number;
    }>;
    volumeTimeline: {
        errors: number;
        total: number;
        timestamp: string;
        hits: number;
        misses: number;
        rateLimited: number;
        timeouts: number;
        byProvider: Record<string, number>;
    }[];
    topBarcodes: {
        barcode: string;
        totalCalls: number;
        hitCount: number;
        missCount: number;
        lastQueriedAt: string;
    }[];
    topMisses: {
        barcode: string;
        missCount: number;
        lastQueriedAt: string;
    }[];
}, {
    range: "7d" | "30d" | "24h";
    summary: {
        totalCalls: number;
        hitCount: number;
        missCount: number;
        errorCount: number;
        rateLimitedCount: number;
        timeoutCount: number;
        hitRatePercent: number;
        errorRatePercent: number;
        avgDurationMs: number;
        p95DurationMs: number;
        cooldownSkippedCount: number;
    };
    providers: Record<string, {
        name: string;
        state: "open" | "healthy" | "degraded" | "exhausted" | "disabled";
        enabled: boolean;
        dailyLimit: number | null;
        todayCallCount: number;
        quotaRemaining: number | null;
        quotaPercentage: number | null;
        breakerState: "open" | "closed" | "halfOpen";
        cooldownActive: boolean;
        cooldownRemainingSeconds: number | null;
        totalCalls: number;
        hitCount: number;
        missCount: number;
        errorCount: number;
        rateLimitedCount: number;
        timeoutCount: number;
        hitRatePercent: number;
        errorRatePercent: number;
        avgDurationMs: number;
        p50DurationMs: number;
        p95DurationMs: number;
        p99DurationMs: number;
        minDurationMs: number;
        maxDurationMs: number;
        timeoutMs: number;
        priority: number;
    }>;
    volumeTimeline: {
        errors: number;
        total: number;
        timestamp: string;
        hits: number;
        misses: number;
        rateLimited: number;
        timeouts: number;
        byProvider: Record<string, number>;
    }[];
    topBarcodes: {
        barcode: string;
        totalCalls: number;
        hitCount: number;
        missCount: number;
        lastQueriedAt: string;
    }[];
    topMisses: {
        barcode: string;
        missCount: number;
        lastQueriedAt: string;
    }[];
}>;
export declare const barcodeProviderSettingSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    timeoutMs: z.ZodDefault<z.ZodNumber>;
    dailyLimit: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    priority: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    dailyLimit: number | null;
    timeoutMs: number;
    priority: number;
}, {
    enabled?: boolean | undefined;
    dailyLimit?: number | null | undefined;
    timeoutMs?: number | undefined;
    priority?: number | undefined;
}>;
export declare const barcodeProviderSettingPatchSchema: z.ZodObject<{
    enabled: z.ZodOptional<z.ZodBoolean>;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
    dailyLimit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    priority: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    enabled?: boolean | undefined;
    dailyLimit?: number | null | undefined;
    timeoutMs?: number | undefined;
    priority?: number | undefined;
}, {
    enabled?: boolean | undefined;
    dailyLimit?: number | null | undefined;
    timeoutMs?: number | undefined;
    priority?: number | undefined;
}>;
export declare const barcodeApiConfigSchema: z.ZodObject<{
    providers: z.ZodRecord<z.ZodString, z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        timeoutMs: z.ZodDefault<z.ZodNumber>;
        dailyLimit: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        priority: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        dailyLimit: number | null;
        timeoutMs: number;
        priority: number;
    }, {
        enabled?: boolean | undefined;
        dailyLimit?: number | null | undefined;
        timeoutMs?: number | undefined;
        priority?: number | undefined;
    }>>;
    retentionDays: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    providers: Record<string, {
        enabled: boolean;
        dailyLimit: number | null;
        timeoutMs: number;
        priority: number;
    }>;
    retentionDays: number | null;
}, {
    providers: Record<string, {
        enabled?: boolean | undefined;
        dailyLimit?: number | null | undefined;
        timeoutMs?: number | undefined;
        priority?: number | undefined;
    }>;
    retentionDays?: number | null | undefined;
}>;
export declare const barcodeApiConfigPatchSchema: z.ZodObject<{
    providers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        enabled: z.ZodOptional<z.ZodBoolean>;
        timeoutMs: z.ZodOptional<z.ZodNumber>;
        dailyLimit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        priority: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        enabled?: boolean | undefined;
        dailyLimit?: number | null | undefined;
        timeoutMs?: number | undefined;
        priority?: number | undefined;
    }, {
        enabled?: boolean | undefined;
        dailyLimit?: number | null | undefined;
        timeoutMs?: number | undefined;
        priority?: number | undefined;
    }>>>;
    retentionDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    providers?: Record<string, {
        enabled?: boolean | undefined;
        dailyLimit?: number | null | undefined;
        timeoutMs?: number | undefined;
        priority?: number | undefined;
    }> | undefined;
    retentionDays?: number | null | undefined;
}, {
    providers?: Record<string, {
        enabled?: boolean | undefined;
        dailyLimit?: number | null | undefined;
        timeoutMs?: number | undefined;
        priority?: number | undefined;
    }> | undefined;
    retentionDays?: number | null | undefined;
}>;
export declare const barcodeApiProbeRequestSchema: z.ZodObject<{
    barcode: z.ZodString;
    provider: z.ZodString;
}, "strip", z.ZodTypeAny, {
    barcode: string;
    provider: string;
}, {
    barcode: string;
    provider: string;
}>;
export declare const barcodeApiProbeResponseSchema: z.ZodObject<{
    provider: z.ZodString;
    barcode: z.ZodString;
    endpoint: z.ZodString;
    durationMs: z.ZodNumber;
    httpStatus: z.ZodNullable<z.ZodNumber>;
    status: z.ZodEnum<["hit", "miss", "rate_limited", "timeout", "error", "cooldown_skipped"]>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    parsedProduct: z.ZodOptional<z.ZodObject<{
        name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        found: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        found: boolean;
        name?: string | null | undefined;
        brand?: string | null | undefined;
    }, {
        found: boolean;
        name?: string | null | undefined;
        brand?: string | null | undefined;
    }>>;
    rawResponsePreview: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    errorMessage: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status: "rate_limited" | "hit" | "miss" | "timeout" | "error" | "cooldown_skipped";
    barcode: string;
    provider: string;
    endpoint: string;
    httpStatus: number | null;
    durationMs: number;
    errorMessage?: string | null | undefined;
    rawResponsePreview?: string | null | undefined;
    headers?: Record<string, string> | undefined;
    parsedProduct?: {
        found: boolean;
        name?: string | null | undefined;
        brand?: string | null | undefined;
    } | undefined;
}, {
    status: "rate_limited" | "hit" | "miss" | "timeout" | "error" | "cooldown_skipped";
    barcode: string;
    provider: string;
    endpoint: string;
    httpStatus: number | null;
    durationMs: number;
    errorMessage?: string | null | undefined;
    rawResponsePreview?: string | null | undefined;
    headers?: Record<string, string> | undefined;
    parsedProduct?: {
        found: boolean;
        name?: string | null | undefined;
        brand?: string | null | undefined;
    } | undefined;
}>;
export declare const barcodeApiResetActionSchema: z.ZodObject<{
    provider: z.ZodString;
    target: z.ZodEnum<["cooldown", "breaker", "all"]>;
}, "strip", z.ZodTypeAny, {
    provider: string;
    target: "all" | "cooldown" | "breaker";
}, {
    provider: string;
    target: "all" | "cooldown" | "breaker";
}>;
export type BarcodeApiStatus = z.infer<typeof barcodeApiStatusSchema>;
export type BarcodeApiCallerContext = z.infer<typeof barcodeApiCallerContextSchema>;
export type BarcodeApiCallLogRow = z.infer<typeof barcodeApiCallLogRowSchema>;
export type BarcodeApiCallLogDetail = z.infer<typeof barcodeApiCallLogDetailSchema>;
export type BarcodeApiRequestsQuery = z.infer<typeof barcodeApiRequestsQuerySchema>;
export type BarcodeApiRequestsList = z.infer<typeof barcodeApiRequestsListSchema>;
export type BarcodeProviderStats = z.infer<typeof barcodeProviderStatsSchema>;
export type BarcodeTimelineBucket = z.infer<typeof barcodeTimelineBucketSchema>;
export type TopBarcode = z.infer<typeof topBarcodeSchema>;
export type TopMiss = z.infer<typeof topMissSchema>;
export type BarcodeApiStats = z.infer<typeof barcodeApiStatsSchema>;
export type BarcodeProviderSetting = z.infer<typeof barcodeProviderSettingSchema>;
export type BarcodeProviderSettingPatch = z.infer<typeof barcodeProviderSettingPatchSchema>;
export type BarcodeApiConfig = z.infer<typeof barcodeApiConfigSchema>;
export type BarcodeApiConfigPatch = z.infer<typeof barcodeApiConfigPatchSchema>;
export type BarcodeApiProbeRequest = z.infer<typeof barcodeApiProbeRequestSchema>;
export type BarcodeApiProbeResponse = z.infer<typeof barcodeApiProbeResponseSchema>;
export type BarcodeApiResetAction = z.infer<typeof barcodeApiResetActionSchema>;
//# sourceMappingURL=barcode-api.d.ts.map