-- Enable product creation for all users by default
UPDATE "settings"
SET "value" = '{"mode": "all"}'::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'product_creation';

INSERT INTO "settings" ("key", "value", "updatedAt")
VALUES ('product_creation', '{"mode": "all"}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE
SET "value" = '{"mode": "all"}'::jsonb, "updatedAt" = CURRENT_TIMESTAMP;
