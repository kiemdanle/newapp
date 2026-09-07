-- CreateIndex
CREATE INDEX IF NOT EXISTS "reviews_status_score_id_idx" ON "reviews"("status", "score" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reviews_status_created_at_id_idx" ON "reviews"("status", "created_at" DESC, "id" DESC);

-- CreateIndex: Database-Enforced Concurrency-Safe Report Dedup
CREATE UNIQUE INDEX IF NOT EXISTS "reports_open_per_reporter_target_idx"
ON "reports" ("reporter_id", "target_type", "target_id")
WHERE "status" = 'open';

-- Clean up legacy not_helpful votes
DELETE FROM "review_votes" WHERE "value" = 'not_helpful';
