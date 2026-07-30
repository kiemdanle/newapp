import { z } from 'zod';
export declare const queueHealthSchema: z.ZodObject<{
    queues: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        waiting: z.ZodNumber;
        active: z.ZodNumber;
        completed: z.ZodNumber;
        failed: z.ZodNumber;
        delayed: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
    }, {
        name: string;
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    queues: {
        name: string;
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
    }[];
}, {
    queues: {
        name: string;
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
    }[];
}>;
export declare const pushLogRowSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    templateKey: z.ZodString;
    status: z.ZodEnum<["sent", "failed"]>;
    errorMessage: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "failed" | "sent";
    id: string;
    userId: string;
    templateKey: string;
    errorMessage: string | null;
    createdAt: string;
}, {
    status: "failed" | "sent";
    id: string;
    userId: string;
    templateKey: string;
    errorMessage: string | null;
    createdAt: string;
}>;
export declare const pushLogsQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
} & {
    userId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["sent", "failed"]>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    status?: "failed" | "sent" | undefined;
    userId?: string | undefined;
    cursor?: string | undefined;
}, {
    status?: "failed" | "sent" | undefined;
    userId?: string | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export declare const pushLogsListSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        templateKey: z.ZodString;
        status: z.ZodEnum<["sent", "failed"]>;
        errorMessage: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "failed" | "sent";
        id: string;
        userId: string;
        templateKey: string;
        errorMessage: string | null;
        createdAt: string;
    }, {
        status: "failed" | "sent";
        id: string;
        userId: string;
        templateKey: string;
        errorMessage: string | null;
        createdAt: string;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "failed" | "sent";
        id: string;
        userId: string;
        templateKey: string;
        errorMessage: string | null;
        createdAt: string;
    }[];
    nextCursor: string | null;
}, {
    items: {
        status: "failed" | "sent";
        id: string;
        userId: string;
        templateKey: string;
        errorMessage: string | null;
        createdAt: string;
    }[];
    nextCursor: string | null;
}>;
export declare const apiErrorsQuerySchema: z.ZodObject<{
    range: z.ZodDefault<z.ZodEnum<["24h", "7d", "30d"]>>;
}, "strip", z.ZodTypeAny, {
    range: "24h" | "7d" | "30d";
}, {
    range?: "24h" | "7d" | "30d" | undefined;
}>;
export declare const apiErrorsAggSchema: z.ZodObject<{
    range: z.ZodEnum<["24h", "7d", "30d"]>;
    rows: z.ZodArray<z.ZodObject<{
        route: z.ZodString;
        method: z.ZodString;
        status: z.ZodNumber;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: number;
        route: string;
        method: string;
        count: number;
    }, {
        status: number;
        route: string;
        method: string;
        count: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    range: "24h" | "7d" | "30d";
    rows: {
        status: number;
        route: string;
        method: string;
        count: number;
    }[];
}, {
    range: "24h" | "7d" | "30d";
    rows: {
        status: number;
        route: string;
        method: string;
        count: number;
    }[];
}>;
export declare const externalApiStateSchema: z.ZodObject<{
    breakers: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        state: z.ZodEnum<["closed", "open", "halfOpen"]>;
        fires: z.ZodNumber;
        failures: z.ZodNumber;
        successes: z.ZodNumber;
        lastFailureAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        state: "closed" | "open" | "halfOpen";
        fires: number;
        failures: number;
        successes: number;
        lastFailureAt: string | null;
    }, {
        name: string;
        state: "closed" | "open" | "halfOpen";
        fires: number;
        failures: number;
        successes: number;
        lastFailureAt: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    breakers: {
        name: string;
        state: "closed" | "open" | "halfOpen";
        fires: number;
        failures: number;
        successes: number;
        lastFailureAt: string | null;
    }[];
}, {
    breakers: {
        name: string;
        state: "closed" | "open" | "halfOpen";
        fires: number;
        failures: number;
        successes: number;
        lastFailureAt: string | null;
    }[];
}>;
export declare const operationalHealthSchema: z.ZodObject<{
    status: z.ZodEnum<["ok", "warning", "critical"]>;
    capacity: z.ZodObject<{
        usableBytes: z.ZodNumber;
        reserveBytes: z.ZodNumber;
        budgetBytes: z.ZodNumber;
        reservedBytes: z.ZodNumber;
        freeBytes: z.ZodNumber;
        freePercent: z.ZodNumber;
        status: z.ZodEnum<["ok", "warning", "critical"]>;
    }, "strip", z.ZodTypeAny, {
        status: "ok" | "warning" | "critical";
        usableBytes: number;
        reserveBytes: number;
        budgetBytes: number;
        reservedBytes: number;
        freeBytes: number;
        freePercent: number;
    }, {
        status: "ok" | "warning" | "critical";
        usableBytes: number;
        reserveBytes: number;
        budgetBytes: number;
        reservedBytes: number;
        freeBytes: number;
        freePercent: number;
    }>;
    cleanup: z.ZodObject<{
        lastSuccessAt: z.ZodNullable<z.ZodString>;
        lastFailureAt: z.ZodNullable<z.ZodString>;
        stale: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        lastFailureAt: string | null;
        lastSuccessAt: string | null;
        stale: boolean;
    }, {
        lastFailureAt: string | null;
        lastSuccessAt: string | null;
        stale: boolean;
    }>;
    pending: z.ZodObject<{
        count: z.ZodNumber;
        oldestAgeHours: z.ZodNullable<z.ZodNumber>;
        stale: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        count: number;
        stale: boolean;
        oldestAgeHours: number | null;
    }, {
        count: number;
        stale: boolean;
        oldestAgeHours: number | null;
    }>;
    quarantine: z.ZodObject<{
        oldestAgeHours: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        oldestAgeHours: number | null;
    }, {
        oldestAgeHours: number | null;
    }>;
    backup: z.ZodObject<{
        lastSuccessAt: z.ZodNullable<z.ZodString>;
        lastFailureAt: z.ZodNullable<z.ZodString>;
        stale: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        lastFailureAt: string | null;
        lastSuccessAt: string | null;
        stale: boolean;
    }, {
        lastFailureAt: string | null;
        lastSuccessAt: string | null;
        stale: boolean;
    }>;
    thresholds: z.ZodObject<{
        freeDiskWarningPercent: z.ZodNumber;
        freeDiskHardStopPercent: z.ZodNumber;
        pendingOldestWarningHours: z.ZodNumber;
        cleanupStaleHours: z.ZodNumber;
        backupStaleHours: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        freeDiskWarningPercent: number;
        freeDiskHardStopPercent: number;
        pendingOldestWarningHours: number;
        cleanupStaleHours: number;
        backupStaleHours: number;
    }, {
        freeDiskWarningPercent: number;
        freeDiskHardStopPercent: number;
        pendingOldestWarningHours: number;
        cleanupStaleHours: number;
        backupStaleHours: number;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "ok" | "warning" | "critical";
    capacity: {
        status: "ok" | "warning" | "critical";
        usableBytes: number;
        reserveBytes: number;
        budgetBytes: number;
        reservedBytes: number;
        freeBytes: number;
        freePercent: number;
    };
    cleanup: {
        lastFailureAt: string | null;
        lastSuccessAt: string | null;
        stale: boolean;
    };
    pending: {
        count: number;
        stale: boolean;
        oldestAgeHours: number | null;
    };
    quarantine: {
        oldestAgeHours: number | null;
    };
    backup: {
        lastFailureAt: string | null;
        lastSuccessAt: string | null;
        stale: boolean;
    };
    thresholds: {
        freeDiskWarningPercent: number;
        freeDiskHardStopPercent: number;
        pendingOldestWarningHours: number;
        cleanupStaleHours: number;
        backupStaleHours: number;
    };
}, {
    status: "ok" | "warning" | "critical";
    capacity: {
        status: "ok" | "warning" | "critical";
        usableBytes: number;
        reserveBytes: number;
        budgetBytes: number;
        reservedBytes: number;
        freeBytes: number;
        freePercent: number;
    };
    cleanup: {
        lastFailureAt: string | null;
        lastSuccessAt: string | null;
        stale: boolean;
    };
    pending: {
        count: number;
        stale: boolean;
        oldestAgeHours: number | null;
    };
    quarantine: {
        oldestAgeHours: number | null;
    };
    backup: {
        lastFailureAt: string | null;
        lastSuccessAt: string | null;
        stale: boolean;
    };
    thresholds: {
        freeDiskWarningPercent: number;
        freeDiskHardStopPercent: number;
        pendingOldestWarningHours: number;
        cleanupStaleHours: number;
        backupStaleHours: number;
    };
}>;
//# sourceMappingURL=system.d.ts.map