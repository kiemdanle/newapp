-- Password reset: magic-link token -> 6-digit OTP with a verify-then-set exchange.
-- Hand-authored (not `prisma migrate dev`) so the code column is RENAMED rather than
-- dropped+added, preserving any in-flight reset rows (RT-10). Column identifiers are
-- camelCase-quoted to match this schema's existing convention (only table names are
-- snake_cased via @@map; columns are not).

-- Preserve in-flight rows: rename the code column instead of drop+add (RT-10).
ALTER TABLE "password_resets" RENAME COLUMN "tokenHash" TO "codeHash";

-- codeHash is looked up by userId, not globally unique (RT-9): drop the unique index.
DROP INDEX "password_resets_tokenHash_key";

-- New OTP lifecycle columns.
ALTER TABLE "password_resets" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "password_resets" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "password_resets" ADD COLUMN "ticketHash" TEXT;
ALTER TABLE "password_resets" ADD COLUMN "ticketExpiresAt" TIMESTAMP(3);
ALTER TABLE "password_resets" ADD COLUMN "consumedAt" TIMESTAMP(3);

-- usedAt is superseded by consumedAt.
ALTER TABLE "password_resets" DROP COLUMN "usedAt";

-- Single-use reset-ticket lookup. Nullable unique is safe: Postgres allows multiple NULLs.
CREATE UNIQUE INDEX "password_resets_ticketHash_key" ON "password_resets"("ticketHash");

-- Full access-token invalidation on reset (RT-11): a per-user token version the
-- requireAuth check compares against the JWT `tv` claim. Safe add — has a default.
ALTER TABLE "users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
