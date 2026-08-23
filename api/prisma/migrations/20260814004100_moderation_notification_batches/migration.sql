-- Durable moderation-notification ledger: one event per successful guarded
-- transition of a product or edit into `pending`, batched every 15 minutes into
-- recipient x channel deliveries with claim-token-fenced leases.

-- CreateEnum
CREATE TYPE "moderation_notification_event_kind" AS ENUM ('new_product', 'product_revision');

-- CreateEnum
CREATE TYPE "moderation_notification_channel" AS ENUM ('push', 'email');

-- CreateEnum
CREATE TYPE "moderation_notification_delivery_status" AS ENUM ('pending', 'processing', 'sent', 'skipped', 'failed');

-- CreateEnum
CREATE TYPE "moderation_notification_push_attempt_status" AS ENUM ('sent', 'failed', 'invalid');

-- One row per successful submission occurrence. `source_id` references a product
-- or edit by `kind` but deliberately has no FK: the notification pipeline must
-- outlive the source row. The post-transition `submission_version` makes a
-- resubmission or rebase a new event while one guarded transition can never
-- double-record. `batch_id` is null until a batch tick claims the event.
CREATE TABLE "moderation_notification_events" (
    "id" UUID NOT NULL,
    "kind" "moderation_notification_event_kind" NOT NULL,
    "source_id" UUID NOT NULL,
    "submission_version" INTEGER NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL,
    "batch_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_notification_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "moderation_notification_events_submission_version_check" CHECK ("submission_version" >= 1)
);

CREATE TABLE "moderation_notification_batches" (
    "id" UUID NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "new_product_count" INTEGER NOT NULL DEFAULT 0,
    "revision_count" INTEGER NOT NULL DEFAULT 0,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_notification_batches_pkey" PRIMARY KEY ("id")
);

-- One recipient x channel delivery per batch. Claim/renew/finalize updates are
-- fenced by (id, status, lease_owner); `completed_at` is set on every terminal
-- transition. No destination email or token value is stored here.
CREATE TABLE "moderation_notification_deliveries" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "channel" "moderation_notification_channel" NOT NULL,
    "status" "moderation_notification_delivery_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_owner" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "provider_message_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_notification_deliveries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "moderation_notification_deliveries_attempts_check" CHECK ("attempts" >= 0),
    CONSTRAINT "moderation_notification_deliveries_lease_state_check" CHECK (
      ("status" = 'processing' AND "lease_owner" IS NOT NULL AND "lease_expires_at" IS NOT NULL)
      OR ("status" <> 'processing')
    ),
    CONSTRAINT "moderation_notification_deliveries_terminal_completed_check" CHECK (
      ("status" = ANY (ARRAY['sent', 'skipped', 'failed']::"moderation_notification_delivery_status"[])
        AND "completed_at" IS NOT NULL)
      OR ("status" = ANY (ARRAY['pending', 'processing']::"moderation_notification_delivery_status"[]))
    )
);

-- Durable per-token outcome for one FCM attempt of a push delivery, so a failed
-- or invalid token never forces a retry of a sibling token that already accepted.
CREATE TABLE "moderation_notification_push_attempts" (
    "id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "push_token_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" "moderation_notification_push_attempt_status" NOT NULL,
    "provider_message_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_notification_push_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "moderation_notification_push_attempts_attempt_number_check" CHECK ("attempt_number" >= 1)
);

-- Event identity: one guarded transition occurrence, resubmissions included.
ALTER TABLE "moderation_notification_events"
  ADD CONSTRAINT "moderation_notification_events_kind_source_id_submission_version_key"
  UNIQUE ("kind", "source_id", "submission_version");

-- Batch tick claims unbatched events in submission order.
CREATE INDEX "moderation_notification_events_unbatched_idx"
  ON "moderation_notification_events" ("submitted_at", "id")
  WHERE "batch_id" IS NULL;

ALTER TABLE "moderation_notification_events"
  ADD CONSTRAINT "moderation_notification_events_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "moderation_notification_batches"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX "moderation_notification_batches_created_at_idx"
  ON "moderation_notification_batches" ("created_at" DESC);

-- Exactly one delivery per recipient x channel per batch.
ALTER TABLE "moderation_notification_deliveries"
  ADD CONSTRAINT "moderation_notification_deliveries_batch_id_recipient_user_id_channel_key"
  UNIQUE ("batch_id", "recipient_user_id", "channel");

-- Dispatcher claims due work (pending, or expired processing leases) by time.
CREATE INDEX "moderation_notification_deliveries_due_idx"
  ON "moderation_notification_deliveries" ("available_at", "lease_expires_at")
  WHERE "status" = ANY (ARRAY['pending', 'processing']::"moderation_notification_delivery_status"[]);

-- 90-day retention cleanup walks batches oldest-first once fully terminal.
CREATE INDEX "moderation_notification_deliveries_batch_status_idx"
  ON "moderation_notification_deliveries" ("batch_id", "status");

ALTER TABLE "moderation_notification_deliveries"
  ADD CONSTRAINT "moderation_notification_deliveries_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "moderation_notification_batches"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT "moderation_notification_deliveries_recipient_user_id_fkey"
  FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- One durable outcome per token per attempt.
ALTER TABLE "moderation_notification_push_attempts"
  ADD CONSTRAINT "moderation_notification_push_attempts_delivery_id_push_token_id_attempt_number_key"
  UNIQUE ("delivery_id", "push_token_id", "attempt_number");

CREATE INDEX "moderation_notification_push_attempts_delivery_id_idx"
  ON "moderation_notification_push_attempts" ("delivery_id");

ALTER TABLE "moderation_notification_push_attempts"
  ADD CONSTRAINT "moderation_notification_push_attempts_delivery_id_fkey"
  FOREIGN KEY ("delivery_id") REFERENCES "moderation_notification_deliveries"("id")
  ON UPDATE CASCADE ON DELETE CASCADE,
  ADD CONSTRAINT "moderation_notification_push_attempts_push_token_id_fkey"
  FOREIGN KEY ("push_token_id") REFERENCES "push_tokens"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- Seed the editable count-only moderation template. ON CONFLICT DO NOTHING so an
-- operator's later edits are never clobbered by a redeploy.
INSERT INTO "notification_templates" ("id", "key", "title", "body", "enabled", "updatedAt")
VALUES (
  '5f3f2a1e-7c2a-4f5a-9b9d-2f0a2b6c9d01',
  'moderation_queue',
  'Moderation queue needs review',
  '{total} new moderation item(s) awaiting review: {newProducts} new product(s), {revisions} revision(s).',
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
