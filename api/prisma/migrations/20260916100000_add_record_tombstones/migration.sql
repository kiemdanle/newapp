-- CreateTable
CREATE TABLE IF NOT EXISTS "record_tombstones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "record_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "household_id" UUID,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_tombstones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "record_tombstones_client_id_key" ON "record_tombstones"("client_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "record_tombstones_user_id_deleted_at_idx" ON "record_tombstones"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "record_tombstones_household_id_deleted_at_idx" ON "record_tombstones"("household_id", "deleted_at");
