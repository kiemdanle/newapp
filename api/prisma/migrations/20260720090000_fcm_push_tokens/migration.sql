-- Native FCM hard cutover for dev-device-only distribution.
-- Renames preserve existing rows; rows are then revoked so devices register fresh tokens.
ALTER TABLE "push_tokens" RENAME COLUMN "expoPushToken" TO "deviceToken";
ALTER INDEX "push_tokens_expoPushToken_key" RENAME TO "push_tokens_deviceToken_key";
UPDATE "push_tokens" SET "revokedAt" = CURRENT_TIMESTAMP WHERE "revokedAt" IS NULL;

ALTER TABLE "push_logs" RENAME COLUMN "expo_ticket_id" TO "provider_message_id";
