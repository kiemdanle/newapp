-- Durable singleton health state for the moderation notification pipeline.
CREATE TABLE "moderation_notification_health" (
    "id" TEXT NOT NULL,
    "last_successful_tick_at" TIMESTAMP(3),
    "last_recovery_at" TIMESTAMP(3),
    "last_scheduler_reconciliation_at" TIMESTAMP(3),
    "last_cleanup_at" TIMESTAMP(3),
    "last_zero_recipient_batch_at" TIMESTAMP(3),
    "terminal_failure_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_batch_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_notification_health_pkey" PRIMARY KEY ("id")
);
