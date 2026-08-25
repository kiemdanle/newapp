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
        active: number;
        name: string;
        waiting: number;
        completed: number;
        failed: number;
        delayed: number;
    }, {
        active: number;
        name: string;
        waiting: number;
        completed: number;
        failed: number;
        delayed: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    queues: {
        active: number;
        name: string;
        waiting: number;
        completed: number;
        failed: number;
        delayed: number;
    }[];
}, {
    queues: {
        active: number;
        name: string;
        waiting: number;
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
    id: string;
    status: "failed" | "sent";
    createdAt: string;
    userId: string;
    templateKey: string;
    errorMessage: string | null;
}, {
    id: string;
    status: "failed" | "sent";
    createdAt: string;
    userId: string;
    templateKey: string;
    errorMessage: string | null;
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
    cursor?: string | undefined;
    userId?: string | undefined;
}, {
    status?: "failed" | "sent" | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
    userId?: string | undefined;
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
        id: string;
        status: "failed" | "sent";
        createdAt: string;
        userId: string;
        templateKey: string;
        errorMessage: string | null;
    }, {
        id: string;
        status: "failed" | "sent";
        createdAt: string;
        userId: string;
        templateKey: string;
        errorMessage: string | null;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        status: "failed" | "sent";
        createdAt: string;
        userId: string;
        templateKey: string;
        errorMessage: string | null;
    }[];
    nextCursor: string | null;
}, {
    items: {
        id: string;
        status: "failed" | "sent";
        createdAt: string;
        userId: string;
        templateKey: string;
        errorMessage: string | null;
    }[];
    nextCursor: string | null;
}>;
export declare const moderationNotificationSummarySchema: z.ZodObject<{
    newProducts: z.ZodNumber;
    revisions: z.ZodNumber;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    newProducts: number;
    revisions: number;
    total: number;
}, {
    newProducts: number;
    revisions: number;
    total: number;
}>;
export declare const moderationNotificationBatchRowSchema: z.ZodObject<{
    id: z.ZodString;
    createdAt: z.ZodString;
    windowStart: z.ZodString;
    windowEnd: z.ZodString;
    newProductCount: z.ZodNumber;
    revisionCount: z.ZodNumber;
    recipientCount: z.ZodNumber;
    deliverySummary: z.ZodObject<{
        pending: z.ZodNumber;
        processing: z.ZodNumber;
        sent: z.ZodNumber;
        skipped: z.ZodNumber;
        failed: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        pending: number;
        failed: number;
        sent: number;
        processing: number;
        skipped: number;
    }, {
        pending: number;
        failed: number;
        sent: number;
        processing: number;
        skipped: number;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    windowStart: string;
    windowEnd: string;
    newProductCount: number;
    revisionCount: number;
    recipientCount: number;
    deliverySummary: {
        pending: number;
        failed: number;
        sent: number;
        processing: number;
        skipped: number;
    };
}, {
    id: string;
    createdAt: string;
    windowStart: string;
    windowEnd: string;
    newProductCount: number;
    revisionCount: number;
    recipientCount: number;
    deliverySummary: {
        pending: number;
        failed: number;
        sent: number;
        processing: number;
        skipped: number;
    };
}>;
export declare const moderationNotificationBatchesQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
} & {
    status: z.ZodOptional<z.ZodEnum<["pending", "processing", "sent", "skipped", "failed"]>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    status?: "pending" | "failed" | "sent" | "processing" | "skipped" | undefined;
    cursor?: string | undefined;
}, {
    status?: "pending" | "failed" | "sent" | "processing" | "skipped" | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export declare const moderationNotificationBatchesListSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        createdAt: z.ZodString;
        windowStart: z.ZodString;
        windowEnd: z.ZodString;
        newProductCount: z.ZodNumber;
        revisionCount: z.ZodNumber;
        recipientCount: z.ZodNumber;
        deliverySummary: z.ZodObject<{
            pending: z.ZodNumber;
            processing: z.ZodNumber;
            sent: z.ZodNumber;
            skipped: z.ZodNumber;
            failed: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            pending: number;
            failed: number;
            sent: number;
            processing: number;
            skipped: number;
        }, {
            pending: number;
            failed: number;
            sent: number;
            processing: number;
            skipped: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        windowStart: string;
        windowEnd: string;
        newProductCount: number;
        revisionCount: number;
        recipientCount: number;
        deliverySummary: {
            pending: number;
            failed: number;
            sent: number;
            processing: number;
            skipped: number;
        };
    }, {
        id: string;
        createdAt: string;
        windowStart: string;
        windowEnd: string;
        newProductCount: number;
        revisionCount: number;
        recipientCount: number;
        deliverySummary: {
            pending: number;
            failed: number;
            sent: number;
            processing: number;
            skipped: number;
        };
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        createdAt: string;
        windowStart: string;
        windowEnd: string;
        newProductCount: number;
        revisionCount: number;
        recipientCount: number;
        deliverySummary: {
            pending: number;
            failed: number;
            sent: number;
            processing: number;
            skipped: number;
        };
    }[];
    nextCursor: string | null;
}, {
    items: {
        id: string;
        createdAt: string;
        windowStart: string;
        windowEnd: string;
        newProductCount: number;
        revisionCount: number;
        recipientCount: number;
        deliverySummary: {
            pending: number;
            failed: number;
            sent: number;
            processing: number;
            skipped: number;
        };
    }[];
    nextCursor: string | null;
}>;
export declare const moderationNotificationDeliveryRowSchema: z.ZodObject<{
    id: z.ZodString;
    batchId: z.ZodString;
    channel: z.ZodEnum<["push", "email"]>;
    status: z.ZodEnum<["pending", "processing", "sent", "skipped", "failed"]>;
    attempts: z.ZodNumber;
    errorMessage: z.ZodNullable<z.ZodString>;
    completedAt: z.ZodNullable<z.ZodString>;
    tokenSummary: z.ZodNullable<z.ZodObject<{
        sent: z.ZodNumber;
        failed: z.ZodNumber;
        invalid: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        failed: number;
        sent: number;
        invalid: number;
    }, {
        failed: number;
        sent: number;
        invalid: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "pending" | "failed" | "sent" | "processing" | "skipped";
    errorMessage: string | null;
    batchId: string;
    channel: "email" | "push";
    attempts: number;
    completedAt: string | null;
    tokenSummary: {
        failed: number;
        sent: number;
        invalid: number;
    } | null;
}, {
    id: string;
    status: "pending" | "failed" | "sent" | "processing" | "skipped";
    errorMessage: string | null;
    batchId: string;
    channel: "email" | "push";
    attempts: number;
    completedAt: string | null;
    tokenSummary: {
        failed: number;
        sent: number;
        invalid: number;
    } | null;
}>;
export declare const moderationNotificationDeliveriesListSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        batchId: z.ZodString;
        channel: z.ZodEnum<["push", "email"]>;
        status: z.ZodEnum<["pending", "processing", "sent", "skipped", "failed"]>;
        attempts: z.ZodNumber;
        errorMessage: z.ZodNullable<z.ZodString>;
        completedAt: z.ZodNullable<z.ZodString>;
        tokenSummary: z.ZodNullable<z.ZodObject<{
            sent: z.ZodNumber;
            failed: z.ZodNumber;
            invalid: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            failed: number;
            sent: number;
            invalid: number;
        }, {
            failed: number;
            sent: number;
            invalid: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "pending" | "failed" | "sent" | "processing" | "skipped";
        errorMessage: string | null;
        batchId: string;
        channel: "email" | "push";
        attempts: number;
        completedAt: string | null;
        tokenSummary: {
            failed: number;
            sent: number;
            invalid: number;
        } | null;
    }, {
        id: string;
        status: "pending" | "failed" | "sent" | "processing" | "skipped";
        errorMessage: string | null;
        batchId: string;
        channel: "email" | "push";
        attempts: number;
        completedAt: string | null;
        tokenSummary: {
            failed: number;
            sent: number;
            invalid: number;
        } | null;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        status: "pending" | "failed" | "sent" | "processing" | "skipped";
        errorMessage: string | null;
        batchId: string;
        channel: "email" | "push";
        attempts: number;
        completedAt: string | null;
        tokenSummary: {
            failed: number;
            sent: number;
            invalid: number;
        } | null;
    }[];
    nextCursor: string | null;
}, {
    items: {
        id: string;
        status: "pending" | "failed" | "sent" | "processing" | "skipped";
        errorMessage: string | null;
        batchId: string;
        channel: "email" | "push";
        attempts: number;
        completedAt: string | null;
        tokenSummary: {
            failed: number;
            sent: number;
            invalid: number;
        } | null;
    }[];
    nextCursor: string | null;
}>;
export declare const moderationNotificationHealthSchema: z.ZodObject<{
    lastSuccessfulTickAt: z.ZodNullable<z.ZodString>;
    lastRecoveryAt: z.ZodNullable<z.ZodString>;
    lastSchedulerReconciliationAt: z.ZodNullable<z.ZodString>;
    lastCleanupAt: z.ZodNullable<z.ZodString>;
    lastZeroRecipientBatchAt: z.ZodNullable<z.ZodString>;
    oldestUnbatchedEventAt: z.ZodNullable<z.ZodString>;
    oldestDueDeliveryAt: z.ZodNullable<z.ZodString>;
    pendingDeliveries: z.ZodNumber;
    terminalFailures: z.ZodNumber;
    deletedBatches: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    lastSuccessfulTickAt: string | null;
    lastRecoveryAt: string | null;
    lastSchedulerReconciliationAt: string | null;
    lastCleanupAt: string | null;
    lastZeroRecipientBatchAt: string | null;
    oldestUnbatchedEventAt: string | null;
    oldestDueDeliveryAt: string | null;
    pendingDeliveries: number;
    terminalFailures: number;
    deletedBatches: number;
}, {
    lastSuccessfulTickAt: string | null;
    lastRecoveryAt: string | null;
    lastSchedulerReconciliationAt: string | null;
    lastCleanupAt: string | null;
    lastZeroRecipientBatchAt: string | null;
    oldestUnbatchedEventAt: string | null;
    oldestDueDeliveryAt: string | null;
    pendingDeliveries: number;
    terminalFailures: number;
    deletedBatches: number;
}>;
export declare const apiErrorsQuerySchema: z.ZodObject<{
    range: z.ZodDefault<z.ZodEnum<["24h", "7d", "30d"]>>;
}, "strip", z.ZodTypeAny, {
    range: "7d" | "30d" | "24h";
}, {
    range?: "7d" | "30d" | "24h" | undefined;
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
        count: number;
        route: string;
        method: string;
    }, {
        status: number;
        count: number;
        route: string;
        method: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    range: "7d" | "30d" | "24h";
    rows: {
        status: number;
        count: number;
        route: string;
        method: string;
    }[];
}, {
    range: "7d" | "30d" | "24h";
    rows: {
        status: number;
        count: number;
        route: string;
        method: string;
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
        state: "open" | "closed" | "halfOpen";
        fires: number;
        failures: number;
        successes: number;
        lastFailureAt: string | null;
    }, {
        name: string;
        state: "open" | "closed" | "halfOpen";
        fires: number;
        failures: number;
        successes: number;
        lastFailureAt: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    breakers: {
        name: string;
        state: "open" | "closed" | "halfOpen";
        fires: number;
        failures: number;
        successes: number;
        lastFailureAt: string | null;
    }[];
}, {
    breakers: {
        name: string;
        state: "open" | "closed" | "halfOpen";
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
    rates: z.ZodObject<{
        assessmentFailurePercent: z.ZodNullable<z.ZodNumber>;
        assessmentFailureExceeded: z.ZodBoolean;
        api5xxPercent: z.ZodNullable<z.ZodNumber>;
        api5xxExceeded: z.ZodBoolean;
        uploadRejectionPercent: z.ZodNullable<z.ZodNumber>;
        uploadRejectionExceeded: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        assessmentFailurePercent: number | null;
        assessmentFailureExceeded: boolean;
        api5xxPercent: number | null;
        api5xxExceeded: boolean;
        uploadRejectionPercent: number | null;
        uploadRejectionExceeded: boolean;
    }, {
        assessmentFailurePercent: number | null;
        assessmentFailureExceeded: boolean;
        api5xxPercent: number | null;
        api5xxExceeded: boolean;
        uploadRejectionPercent: number | null;
        uploadRejectionExceeded: boolean;
    }>;
    thresholds: z.ZodObject<{
        freeDiskWarningPercent: z.ZodNumber;
        freeDiskHardStopPercent: z.ZodNumber;
        pendingOldestWarningHours: z.ZodNumber;
        cleanupStaleHours: z.ZodNumber;
        backupStaleHours: z.ZodNumber;
        assessmentFailureRatePercent: z.ZodNumber;
        api5xxRatePercent: z.ZodNumber;
        uploadRejectionRatePercent: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        freeDiskWarningPercent: number;
        freeDiskHardStopPercent: number;
        pendingOldestWarningHours: number;
        cleanupStaleHours: number;
        backupStaleHours: number;
        assessmentFailureRatePercent: number;
        api5xxRatePercent: number;
        uploadRejectionRatePercent: number;
    }, {
        freeDiskWarningPercent: number;
        freeDiskHardStopPercent: number;
        pendingOldestWarningHours: number;
        cleanupStaleHours: number;
        backupStaleHours: number;
        assessmentFailureRatePercent: number;
        api5xxRatePercent: number;
        uploadRejectionRatePercent: number;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "ok" | "warning" | "critical";
    pending: {
        count: number;
        stale: boolean;
        oldestAgeHours: number | null;
    };
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
    quarantine: {
        oldestAgeHours: number | null;
    };
    backup: {
        lastFailureAt: string | null;
        lastSuccessAt: string | null;
        stale: boolean;
    };
    rates: {
        assessmentFailurePercent: number | null;
        assessmentFailureExceeded: boolean;
        api5xxPercent: number | null;
        api5xxExceeded: boolean;
        uploadRejectionPercent: number | null;
        uploadRejectionExceeded: boolean;
    };
    thresholds: {
        freeDiskWarningPercent: number;
        freeDiskHardStopPercent: number;
        pendingOldestWarningHours: number;
        cleanupStaleHours: number;
        backupStaleHours: number;
        assessmentFailureRatePercent: number;
        api5xxRatePercent: number;
        uploadRejectionRatePercent: number;
    };
}, {
    status: "ok" | "warning" | "critical";
    pending: {
        count: number;
        stale: boolean;
        oldestAgeHours: number | null;
    };
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
    quarantine: {
        oldestAgeHours: number | null;
    };
    backup: {
        lastFailureAt: string | null;
        lastSuccessAt: string | null;
        stale: boolean;
    };
    rates: {
        assessmentFailurePercent: number | null;
        assessmentFailureExceeded: boolean;
        api5xxPercent: number | null;
        api5xxExceeded: boolean;
        uploadRejectionPercent: number | null;
        uploadRejectionExceeded: boolean;
    };
    thresholds: {
        freeDiskWarningPercent: number;
        freeDiskHardStopPercent: number;
        pendingOldestWarningHours: number;
        cleanupStaleHours: number;
        backupStaleHours: number;
        assessmentFailureRatePercent: number;
        api5xxRatePercent: number;
        uploadRejectionRatePercent: number;
    };
}>;
//# sourceMappingURL=system.d.ts.map