import { z } from 'zod';
export declare const googleMapsTimeRangeSchema: z.ZodDefault<z.ZodEnum<["24h", "7d", "30d"]>>;
export type GoogleMapsTimeRange = z.infer<typeof googleMapsTimeRangeSchema>;
export declare const googleMapsAnalyticsQuerySchema: z.ZodObject<{
    timeRange: z.ZodDefault<z.ZodEnum<["24h", "7d", "30d"]>>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    status: z.ZodDefault<z.ZodEnum<["all", "success", "cached", "error"]>>;
}, "strip", z.ZodTypeAny, {
    status: "all" | "success" | "cached" | "error";
    limit: number;
    timeRange: "24h" | "7d" | "30d";
    page: number;
}, {
    status?: "all" | "success" | "cached" | "error" | undefined;
    limit?: number | undefined;
    timeRange?: "24h" | "7d" | "30d" | undefined;
    page?: number | undefined;
}>;
export type GoogleMapsAnalyticsQuery = z.infer<typeof googleMapsAnalyticsQuerySchema>;
export declare const googleMapsLogItemSchema: z.ZodObject<{
    id: z.ZodString;
    endpoint: z.ZodString;
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
    status: z.ZodString;
    httpStatus: z.ZodNullable<z.ZodNumber>;
    durationMs: z.ZodNumber;
    formattedAddress: z.ZodNullable<z.ZodString>;
    countryCode: z.ZodNullable<z.ZodString>;
    errorMessage: z.ZodNullable<z.ZodString>;
    callerContext: z.ZodString;
    userId: z.ZodNullable<z.ZodString>;
    userEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    latitude: number;
    longitude: number;
    status: string;
    createdAt: string;
    endpoint: string;
    httpStatus: number | null;
    durationMs: number;
    formattedAddress: string | null;
    countryCode: string | null;
    errorMessage: string | null;
    callerContext: string;
    userId: string | null;
    userEmail?: string | null | undefined;
}, {
    id: string;
    latitude: number;
    longitude: number;
    status: string;
    createdAt: string;
    endpoint: string;
    httpStatus: number | null;
    durationMs: number;
    formattedAddress: string | null;
    countryCode: string | null;
    errorMessage: string | null;
    callerContext: string;
    userId: string | null;
    userEmail?: string | null | undefined;
}>;
export type GoogleMapsLogItem = z.infer<typeof googleMapsLogItemSchema>;
export declare const googleMapsVolumePointSchema: z.ZodObject<{
    date: z.ZodString;
    total: z.ZodNumber;
    success: z.ZodNumber;
    cached: z.ZodNumber;
    error: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    date: string;
    success: number;
    cached: number;
    error: number;
    total: number;
}, {
    date: string;
    success: number;
    cached: number;
    error: number;
    total: number;
}>;
export type GoogleMapsVolumePoint = z.infer<typeof googleMapsVolumePointSchema>;
export declare const googleMapsSummarySchema: z.ZodObject<{
    timeRange: z.ZodDefault<z.ZodEnum<["24h", "7d", "30d"]>>;
    todayRequests: z.ZodNumber;
    dailyQuotaLimit: z.ZodNumber;
    dailyQuotaPercentage: z.ZodNumber;
    monthlyRequests: z.ZodNumber;
    monthlyFreeTierLimit: z.ZodNumber;
    estimatedCostUsd: z.ZodNumber;
    totalRequestsInRange: z.ZodNumber;
    cacheHitCount: z.ZodNumber;
    cacheHitRatio: z.ZodNumber;
    errorCount: z.ZodNumber;
    avgDurationMs: z.ZodNumber;
    p95DurationMs: z.ZodNumber;
    alertLevel: z.ZodEnum<["normal", "warning", "critical"]>;
    volumeSeries: z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        total: z.ZodNumber;
        success: z.ZodNumber;
        cached: z.ZodNumber;
        error: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        date: string;
        success: number;
        cached: number;
        error: number;
        total: number;
    }, {
        date: string;
        success: number;
        cached: number;
        error: number;
        total: number;
    }>, "many">;
    logs: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        endpoint: z.ZodString;
        latitude: z.ZodNumber;
        longitude: z.ZodNumber;
        status: z.ZodString;
        httpStatus: z.ZodNullable<z.ZodNumber>;
        durationMs: z.ZodNumber;
        formattedAddress: z.ZodNullable<z.ZodString>;
        countryCode: z.ZodNullable<z.ZodString>;
        errorMessage: z.ZodNullable<z.ZodString>;
        callerContext: z.ZodString;
        userId: z.ZodNullable<z.ZodString>;
        userEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        latitude: number;
        longitude: number;
        status: string;
        createdAt: string;
        endpoint: string;
        httpStatus: number | null;
        durationMs: number;
        formattedAddress: string | null;
        countryCode: string | null;
        errorMessage: string | null;
        callerContext: string;
        userId: string | null;
        userEmail?: string | null | undefined;
    }, {
        id: string;
        latitude: number;
        longitude: number;
        status: string;
        createdAt: string;
        endpoint: string;
        httpStatus: number | null;
        durationMs: number;
        formattedAddress: string | null;
        countryCode: string | null;
        errorMessage: string | null;
        callerContext: string;
        userId: string | null;
        userEmail?: string | null | undefined;
    }>, "many">;
    totalLogs: z.ZodNumber;
    page: z.ZodNumber;
    totalPages: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    timeRange: "24h" | "7d" | "30d";
    page: number;
    todayRequests: number;
    dailyQuotaLimit: number;
    dailyQuotaPercentage: number;
    monthlyRequests: number;
    monthlyFreeTierLimit: number;
    estimatedCostUsd: number;
    totalRequestsInRange: number;
    cacheHitCount: number;
    cacheHitRatio: number;
    errorCount: number;
    avgDurationMs: number;
    p95DurationMs: number;
    alertLevel: "normal" | "warning" | "critical";
    volumeSeries: {
        date: string;
        success: number;
        cached: number;
        error: number;
        total: number;
    }[];
    logs: {
        id: string;
        latitude: number;
        longitude: number;
        status: string;
        createdAt: string;
        endpoint: string;
        httpStatus: number | null;
        durationMs: number;
        formattedAddress: string | null;
        countryCode: string | null;
        errorMessage: string | null;
        callerContext: string;
        userId: string | null;
        userEmail?: string | null | undefined;
    }[];
    totalLogs: number;
    totalPages: number;
}, {
    page: number;
    todayRequests: number;
    dailyQuotaLimit: number;
    dailyQuotaPercentage: number;
    monthlyRequests: number;
    monthlyFreeTierLimit: number;
    estimatedCostUsd: number;
    totalRequestsInRange: number;
    cacheHitCount: number;
    cacheHitRatio: number;
    errorCount: number;
    avgDurationMs: number;
    p95DurationMs: number;
    alertLevel: "normal" | "warning" | "critical";
    volumeSeries: {
        date: string;
        success: number;
        cached: number;
        error: number;
        total: number;
    }[];
    logs: {
        id: string;
        latitude: number;
        longitude: number;
        status: string;
        createdAt: string;
        endpoint: string;
        httpStatus: number | null;
        durationMs: number;
        formattedAddress: string | null;
        countryCode: string | null;
        errorMessage: string | null;
        callerContext: string;
        userId: string | null;
        userEmail?: string | null | undefined;
    }[];
    totalLogs: number;
    totalPages: number;
    timeRange?: "24h" | "7d" | "30d" | undefined;
}>;
export type GoogleMapsSummary = z.infer<typeof googleMapsSummarySchema>;
export declare const googleMapsProbeRequestSchema: z.ZodObject<{
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    latitude: number;
    longitude: number;
}, {
    latitude: number;
    longitude: number;
}>;
export type GoogleMapsProbeRequest = z.infer<typeof googleMapsProbeRequestSchema>;
export declare const googleMapsProbeResponseSchema: z.ZodObject<{
    formattedAddress: z.ZodString;
    countryCode: z.ZodString;
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
    durationMs: z.ZodNumber;
    cached: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    latitude: number;
    longitude: number;
    cached: boolean;
    durationMs: number;
    formattedAddress: string;
    countryCode: string;
}, {
    latitude: number;
    longitude: number;
    cached: boolean;
    durationMs: number;
    formattedAddress: string;
    countryCode: string;
}>;
export type GoogleMapsProbeResponse = z.infer<typeof googleMapsProbeResponseSchema>;
//# sourceMappingURL=google-maps-analytics.d.ts.map