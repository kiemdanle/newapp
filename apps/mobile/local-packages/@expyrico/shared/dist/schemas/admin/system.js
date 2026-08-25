import { z } from 'zod';
import { cursorQuerySchema, cursorPageSchema } from './common.js';
export const queueHealthSchema = z.object({
    queues: z.array(z.object({
        name: z.string(),
        waiting: z.number().int(),
        active: z.number().int(),
        completed: z.number().int(),
        failed: z.number().int(),
        delayed: z.number().int(),
    })),
});
export const pushLogRowSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    templateKey: z.string(),
    status: z.enum(['sent', 'failed']),
    errorMessage: z.string().nullable(),
    createdAt: z.string().datetime(),
});
export const pushLogsQuerySchema = cursorQuerySchema.extend({
    userId: z.string().uuid().optional(),
    status: z.enum(['sent', 'failed']).optional(),
});
export const pushLogsListSchema = cursorPageSchema(pushLogRowSchema);
export const moderationNotificationSummarySchema = z.object({
    newProducts: z.number().int().nonnegative(),
    revisions: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
});
const moderationDeliveryStatusSchema = z.enum(['pending', 'processing', 'sent', 'skipped', 'failed']);
export const moderationNotificationBatchRowSchema = z.object({
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    windowStart: z.string().datetime(),
    windowEnd: z.string().datetime(),
    newProductCount: z.number().int().nonnegative(),
    revisionCount: z.number().int().nonnegative(),
    recipientCount: z.number().int().nonnegative(),
    deliverySummary: z.object({
        pending: z.number().int().nonnegative(),
        processing: z.number().int().nonnegative(),
        sent: z.number().int().nonnegative(),
        skipped: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
    }),
});
export const moderationNotificationBatchesQuerySchema = cursorQuerySchema.extend({
    status: moderationDeliveryStatusSchema.optional(),
});
export const moderationNotificationBatchesListSchema = cursorPageSchema(moderationNotificationBatchRowSchema);
export const moderationNotificationDeliveryRowSchema = z.object({
    id: z.string().uuid(),
    batchId: z.string().uuid(),
    channel: z.enum(['push', 'email']),
    status: moderationDeliveryStatusSchema,
    attempts: z.number().int().nonnegative(),
    errorMessage: z.string().nullable(),
    completedAt: z.string().datetime().nullable(),
    tokenSummary: z.object({
        sent: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        invalid: z.number().int().nonnegative(),
    }).nullable(),
});
export const moderationNotificationDeliveriesListSchema = cursorPageSchema(moderationNotificationDeliveryRowSchema);
export const moderationNotificationHealthSchema = z.object({
    lastSuccessfulTickAt: z.string().datetime().nullable(),
    lastRecoveryAt: z.string().datetime().nullable(),
    lastSchedulerReconciliationAt: z.string().datetime().nullable(),
    lastCleanupAt: z.string().datetime().nullable(),
    lastZeroRecipientBatchAt: z.string().datetime().nullable(),
    oldestUnbatchedEventAt: z.string().datetime().nullable(),
    oldestDueDeliveryAt: z.string().datetime().nullable(),
    pendingDeliveries: z.number().int().nonnegative(),
    terminalFailures: z.number().int().nonnegative(),
    deletedBatches: z.number().int().nonnegative(),
});
export const apiErrorsQuerySchema = z.object({
    range: z.enum(['24h', '7d', '30d']).default('24h'),
});
export const apiErrorsAggSchema = z.object({
    range: z.enum(['24h', '7d', '30d']),
    rows: z.array(z.object({
        route: z.string(),
        method: z.string(),
        status: z.number().int(),
        count: z.number().int(),
    })),
});
export const externalApiStateSchema = z.object({
    breakers: z.array(z.object({
        name: z.string(),
        state: z.enum(['closed', 'open', 'halfOpen']),
        fires: z.number().int(),
        failures: z.number().int(),
        successes: z.number().int(),
        lastFailureAt: z.string().datetime().nullable(),
    })),
});
// Phase 7: the protected operational health payload — media capacity, cleanup
// sweep staleness, pending-review backlog age, quarantine age, and backup
// staleness, plus the config-sourced thresholds each `status` is computed
// against (never hardcoded on the client either).
const healthStatusSchema = z.enum(['ok', 'warning', 'critical']);
export const operationalHealthSchema = z.object({
    status: healthStatusSchema,
    capacity: z.object({
        usableBytes: z.number().int(),
        reserveBytes: z.number().int(),
        budgetBytes: z.number().int(),
        reservedBytes: z.number().int(),
        freeBytes: z.number().int(),
        freePercent: z.number(),
        status: healthStatusSchema,
    }),
    cleanup: z.object({
        lastSuccessAt: z.string().datetime().nullable(),
        lastFailureAt: z.string().datetime().nullable(),
        stale: z.boolean(),
    }),
    pending: z.object({
        count: z.number().int(),
        oldestAgeHours: z.number().nullable(),
        stale: z.boolean(),
    }),
    quarantine: z.object({
        oldestAgeHours: z.number().nullable(),
    }),
    backup: z.object({
        lastSuccessAt: z.string().datetime().nullable(),
        lastFailureAt: z.string().datetime().nullable(),
        stale: z.boolean(),
    }),
    // reviewer-p7 IM5: the three rolling-15-minute rate thresholds (assessment
    // provider failures, API 5xx, upload validation rejections) were parsed
    // into config with no consumer or payload field anywhere.
    rates: z.object({
        assessmentFailurePercent: z.number().nullable(),
        assessmentFailureExceeded: z.boolean(),
        api5xxPercent: z.number().nullable(),
        api5xxExceeded: z.boolean(),
        uploadRejectionPercent: z.number().nullable(),
        uploadRejectionExceeded: z.boolean(),
    }),
    thresholds: z.object({
        freeDiskWarningPercent: z.number(),
        freeDiskHardStopPercent: z.number(),
        pendingOldestWarningHours: z.number(),
        cleanupStaleHours: z.number(),
        backupStaleHours: z.number(),
        assessmentFailureRatePercent: z.number(),
        api5xxRatePercent: z.number(),
        uploadRejectionRatePercent: z.number(),
    }),
});
//# sourceMappingURL=system.js.map