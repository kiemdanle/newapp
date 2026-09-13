-- CreateTable
CREATE TABLE IF NOT EXISTS "barcode_api_call_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" VARCHAR(64) NOT NULL,
    "barcode" VARCHAR(64) NOT NULL,
    "endpoint" TEXT NOT NULL,
    "http_method" VARCHAR(16) NOT NULL DEFAULT 'GET',
    "status" VARCHAR(32) NOT NULL,
    "http_status" SMALLINT,
    "duration_ms" INTEGER NOT NULL,
    "error_message" TEXT,
    "response_size_bytes" INTEGER,
    "caller_context" VARCHAR(32) NOT NULL DEFAULT 'sync_lookup',
    "request_headers" JSONB,
    "response_headers" JSONB,
    "raw_response_preview" TEXT,
    "user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barcode_api_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "barcode_api_call_logs_provider_created_at_idx" ON "barcode_api_call_logs"("provider", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "barcode_api_call_logs_created_at_idx" ON "barcode_api_call_logs"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "barcode_api_call_logs_barcode_idx" ON "barcode_api_call_logs"("barcode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "barcode_api_call_logs_status_created_at_idx" ON "barcode_api_call_logs"("status", "created_at");
