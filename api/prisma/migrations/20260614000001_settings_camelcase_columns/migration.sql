-- Align settings and notification_templates columns with Prisma schema camelCase conventions
ALTER TABLE "settings" RENAME COLUMN "updated_at" TO "updatedAt";
ALTER TABLE "settings" RENAME COLUMN "updated_by" TO "updatedBy";
ALTER TABLE "notification_templates" RENAME COLUMN "updated_at" TO "updatedAt";
ALTER TABLE "notification_templates" RENAME COLUMN "updated_by" TO "updatedBy";
