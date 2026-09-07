-- AlterTable
ALTER TABLE "records" ADD COLUMN IF NOT EXISTS "discarded_at" TIMESTAMP(3);
ALTER TABLE "records" ADD COLUMN IF NOT EXISTS "discard_reason" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "records_user_id_status_discarded_at_idx" ON "records"("user_id", "status", "discarded_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "records_user_id_status_consumed_at_idx" ON "records"("user_id", "status", "consumed_at");
