/*
  M1 Personal Pantry: products, product_edits, records, push_logs.
  Also converts push_tokens.platform from text to the PushPlatform enum
  via an ALTER ... USING cast, and enables pg_trgm with a GIN index on
  (name, brand) for fuzzy product search.
*/
-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('off', 'upcitemdb', 'user');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('active', 'pending', 'merged_into');

-- CreateEnum
CREATE TYPE "product_edit_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('active', 'consumed', 'discarded', 'expired');

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('ios', 'android');

-- CreateEnum
CREATE TYPE "push_log_status" AS ENUM ('sent', 'failed');

-- AlterTable
-- D27: convert push_tokens.platform from text → PushPlatform enum.
-- Prisma's default emit drops + recreates the column, which fails on existing data
-- (and there's no auto-cast text→enum). M0a's existing values 'ios'/'android' are
-- already valid enum strings, so the cast is a straightforward one-to-one.
ALTER TABLE "push_tokens"
  ALTER COLUMN "platform" TYPE "PushPlatform" USING "platform"::"PushPlatform";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notificationPreferences" JSONB;

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "barcode" TEXT,
    "qr_payload" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT,
    "image_url" TEXT,
    "default_shelf_life_days" INTEGER,
    "source" "ProductSource" NOT NULL,
    "source_id" TEXT,
    "taste_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "value_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" UUID,
    "status" "ProductStatus" NOT NULL DEFAULT 'active',
    "merged_into_product_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_edits" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "submitted_by" UUID NOT NULL,
    "proposed" JSONB NOT NULL,
    "status" "product_edit_status" NOT NULL DEFAULT 'pending',
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" UUID,
    "custom_name" TEXT,
    "expiry_date" DATE NOT NULL,
    "purchase_date" DATE,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "notes" TEXT,
    "photo_url" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "notify_at" JSONB NOT NULL DEFAULT '[]',
    "client_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),

    CONSTRAINT "records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "record_id" UUID,
    "expo_ticket_id" TEXT,
    "template_key" TEXT NOT NULL,
    "status" "push_log_status" NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "products_qr_payload_key" ON "products"("qr_payload");

-- CreateIndex
CREATE INDEX "products_source_source_id_idx" ON "products"("source", "source_id");

-- CreateIndex
CREATE INDEX "product_edits_status_created_at_idx" ON "product_edits"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "product_edits_product_id_idx" ON "product_edits"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "records_client_id_key" ON "records"("client_id");

-- CreateIndex
CREATE INDEX "records_user_id_status_expiry_date_idx" ON "records"("user_id", "status", "expiry_date");

-- CreateIndex
CREATE INDEX "push_logs_user_id_created_at_idx" ON "push_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "push_logs_status_created_at_idx" ON "push_logs"("status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_merged_into_product_id_fkey" FOREIGN KEY ("merged_into_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_edits" ADD CONSTRAINT "product_edits_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_edits" ADD CONSTRAINT "product_edits_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_edits" ADD CONSTRAINT "product_edits_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "records" ADD CONSTRAINT "records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "records" ADD CONSTRAINT "records_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_logs" ADD CONSTRAINT "push_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_logs" ADD CONSTRAINT "push_logs_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable pg_trgm (no-op if M0a already enabled it)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on name + brand for fuzzy search
CREATE INDEX IF NOT EXISTS products_name_brand_trgm
  ON products
  USING GIN ((coalesce(name, '') || ' ' || coalesce(brand, '')) gin_trgm_ops);
