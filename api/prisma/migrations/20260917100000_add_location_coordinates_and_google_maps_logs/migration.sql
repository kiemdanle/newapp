-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "giveaways" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "giveaways" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "giveaways_latitude_longitude_idx" ON "giveaways"("latitude", "longitude");

-- CreateTable
CREATE TABLE IF NOT EXISTS "google_maps_api_call_logs" (
    "id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "http_status" SMALLINT,
    "duration_ms" INTEGER NOT NULL,
    "formatted_address" TEXT,
    "country_code" CHAR(2),
    "error_message" TEXT,
    "caller_context" VARCHAR(32) NOT NULL DEFAULT 'profile_location',
    "user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_maps_api_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "google_maps_api_call_logs_created_at_idx" ON "google_maps_api_call_logs"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "google_maps_api_call_logs_status_created_at_idx" ON "google_maps_api_call_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "google_maps_api_call_logs_user_id_created_at_idx" ON "google_maps_api_call_logs"("user_id", "created_at");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'google_maps_api_call_logs_user_id_fkey'
  ) THEN
    ALTER TABLE "google_maps_api_call_logs" ADD CONSTRAINT "google_maps_api_call_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
