-- Align api_errors column naming with Prisma schema camelCase conventions
ALTER TABLE "api_errors" RENAME COLUMN "created_at" TO "createdAt";
