-- AlterTable
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_dismissed_from_templates" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_created_by_user_id_is_dismissed_from_templates_status_idx" ON "products"("created_by_user_id", "is_dismissed_from_templates", "status");

-- CreateIndex for user photo contribution XP queries
CREATE INDEX IF NOT EXISTS "product_photos_uploaded_by_user_id_product_id_idx" ON "product_photos"("uploaded_by_user_id", "product_id");

-- CreateIndex for user edit contribution XP queries
CREATE INDEX IF NOT EXISTS "product_edits_submitted_by_status_product_id_idx" ON "product_edits"("submitted_by", "status", "product_id");
