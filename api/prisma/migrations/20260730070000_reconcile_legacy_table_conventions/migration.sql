-- Several pre-Phase-1 migrations were hand-authored directly against raw SQL
-- (not generated via `prisma migrate dev`) and drifted from the conventions
-- `schema.prisma` now documents: a stale `ThemePreference` enum value nobody
-- ever removed, DB-level `id` defaults where Prisma generates UUIDs
-- client-side, `TIMESTAMPTZ` where the datamodel expects `TIMESTAMP(3)`, a
-- leftover `DEFAULT 'buy_again'` on `reviews.rating`, and a few
-- indexes/foreign-key names that never matched their current `@@index`/
-- relation declarations. The live database already matches `schema.prisma`
-- exactly (verified via `prisma migrate diff --from-url <pantry> --to-schema-datamodel
-- schema.prisma` = empty) — this migration exists so that REPLAYING
-- `api/prisma/migrations/*` from scratch reaches the same state, which it did
-- not before (a fresh scratch-DB provision diffed non-empty against
-- schema.prisma on these tables). Every statement below is safe to run
-- against an already-corrected database: DROP DEFAULT/SET DATA TYPE are
-- no-ops when already in the target shape, and the constraint/index/enum
-- changes are explicitly guarded so a repeat run (or a run against a DB that
-- was hand-corrected out of band, like the live one) does nothing.

-- --- ThemePreference: drop the unused legacy 'aurora' value -----------------
-- Only rebuild the type if 'aurora' is still a valid label; every reader of
-- `themePreference` already treats 'aurora' as dead (schema.prisma's enum
-- never included it), and migration 20260703081600 already converted every
-- row off it, so this is a pure cleanup with no data impact.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ThemePreference' AND e.enumlabel = 'aurora'
  ) THEN
    IF EXISTS (SELECT 1 FROM users WHERE "themePreference"::text = 'aurora') THEN
      RAISE EXCEPTION 'Cannot drop ThemePreference.aurora: rows still reference it';
    END IF;

    CREATE TYPE "ThemePreference_new" AS ENUM ('expyrico', 'bento', 'clay', 'material');
    ALTER TABLE "users" ALTER COLUMN "themePreference" DROP DEFAULT;
    ALTER TABLE "users" ALTER COLUMN "themePreference" TYPE "ThemePreference_new"
      USING ("themePreference"::text::"ThemePreference_new");
    ALTER TYPE "ThemePreference" RENAME TO "ThemePreference_old";
    ALTER TYPE "ThemePreference_new" RENAME TO "ThemePreference";
    DROP TYPE "ThemePreference_old";
    ALTER TABLE "users" ALTER COLUMN "themePreference" SET DEFAULT 'expyrico';
  END IF;
END $$;

-- --- Drop FKs that must be recreated once their referenced/referencing ------
-- --- columns change type below (Postgres forbids altering a column type ----
-- --- while a dependent constraint exists) -----------------------------------
ALTER TABLE "deal_votes" DROP CONSTRAINT IF EXISTS "deal_votes_deal_id_fkey";
ALTER TABLE "deal_votes" DROP CONSTRAINT IF EXISTS "deal_votes_user_id_fkey";
ALTER TABLE "deals" DROP CONSTRAINT IF EXISTS "deals_product_id_fkey";
ALTER TABLE "deals" DROP CONSTRAINT IF EXISTS "deals_user_id_fkey";
ALTER TABLE "giveaway_claims" DROP CONSTRAINT IF EXISTS "giveaway_claims_claimer_user_id_fkey";
ALTER TABLE "giveaway_claims" DROP CONSTRAINT IF EXISTS "giveaway_claims_giveaway_id_fkey";
ALTER TABLE "giveaways" DROP CONSTRAINT IF EXISTS "giveaways_giver_user_id_fkey";
ALTER TABLE "giveaways" DROP CONSTRAINT IF EXISTS "giveaways_product_id_fkey";
ALTER TABLE "giveaways" DROP CONSTRAINT IF EXISTS "giveaways_record_id_fkey";
ALTER TABLE "household_members" DROP CONSTRAINT IF EXISTS "household_members_household_id_fkey";
ALTER TABLE "household_members" DROP CONSTRAINT IF EXISTS "household_members_user_id_fkey";
ALTER TABLE "households" DROP CONSTRAINT IF EXISTS "households_owner_user_id_fkey";
ALTER TABLE "records" DROP CONSTRAINT IF EXISTS "records_household_id_fkey";
ALTER TABLE "referrals" DROP CONSTRAINT IF EXISTS "referrals_referred_user_id_fkey";
ALTER TABLE "referrals" DROP CONSTRAINT IF EXISTS "referrals_referrer_user_id_fkey";
ALTER TABLE "transaction_ratings" DROP CONSTRAINT IF EXISTS "transaction_ratings_giveaway_id_fkey";
ALTER TABLE "transaction_ratings" DROP CONSTRAINT IF EXISTS "transaction_ratings_ratee_user_id_fkey";
ALTER TABLE "transaction_ratings" DROP CONSTRAINT IF EXISTS "transaction_ratings_rater_user_id_fkey";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_referred_by_user_id_fkey";

-- --- id: drop the hand-added DB-level default (Prisma generates the UUID ----
-- --- client-side for `@default(uuid())`; these tables were the only ones ---
-- --- with a `gen_random_uuid()` DB default) / timestamptz -> timestamp(3) --
ALTER TABLE "api_errors"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

ALTER TABLE "deal_votes"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

ALTER TABLE "deals"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "updated_at" DROP DEFAULT,
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

ALTER TABLE "giveaway_claims"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

ALTER TABLE "giveaways"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "claim_expires_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "updated_at" DROP DEFAULT,
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "handed_off_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "confirmed_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "completed_at" SET DATA TYPE TIMESTAMP(3);

ALTER TABLE "household_members"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "joined_at" SET DATA TYPE TIMESTAMP(3);

ALTER TABLE "households"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "updated_at" DROP DEFAULT,
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

ALTER TABLE "notification_outbox"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "dispatched_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

ALTER TABLE "notification_templates"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT,
  ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

ALTER TABLE "referrals"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "activated_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- Hand-authored migration 20260608130000 added a convenience DB default so its
-- own backfill statement could run; the application always supplies `rating`
-- explicitly (see `reviewCreateSchema`), and schema.prisma never declared one.
ALTER TABLE "reviews" ALTER COLUMN "rating" DROP DEFAULT;

ALTER TABLE "settings"
  ALTER COLUMN "updatedAt" DROP DEFAULT,
  ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

ALTER TABLE "transaction_ratings"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "revealed_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- --- Indexes schema.prisma declares that the hand-authored migrations -------
-- --- never added ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "deals_status_created_at_idx" ON "deals"("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "giveaway_claims_giveaway_id_status_idx" ON "giveaway_claims"("giveaway_id", "status");
CREATE INDEX IF NOT EXISTS "giveaways_giver_user_id_status_idx" ON "giveaways"("giver_user_id", "status");
CREATE INDEX IF NOT EXISTS "giveaways_status_claim_expires_at_idx" ON "giveaways"("status", "claim_expires_at");
CREATE INDEX IF NOT EXISTS "notification_outbox_dispatched_at_created_at_idx" ON "notification_outbox"("dispatched_at", "created_at");

-- --- Recreate the FKs dropped above (guarded: skip if already present, so a
-- --- repeat run or a DB that already carries these constraints is a no-op) --
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_referred_by_user_id_fkey') THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_user_id_fkey"
      FOREIGN KEY ("referred_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'records_household_id_fkey') THEN
    ALTER TABLE "records" ADD CONSTRAINT "records_household_id_fkey"
      FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_user_id_fkey') THEN
    ALTER TABLE "deals" ADD CONSTRAINT "deals_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_product_id_fkey') THEN
    ALTER TABLE "deals" ADD CONSTRAINT "deals_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deal_votes_user_id_fkey') THEN
    ALTER TABLE "deal_votes" ADD CONSTRAINT "deal_votes_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deal_votes_deal_id_fkey') THEN
    ALTER TABLE "deal_votes" ADD CONSTRAINT "deal_votes_deal_id_fkey"
      FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'giveaways_giver_user_id_fkey') THEN
    ALTER TABLE "giveaways" ADD CONSTRAINT "giveaways_giver_user_id_fkey"
      FOREIGN KEY ("giver_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'giveaways_product_id_fkey') THEN
    ALTER TABLE "giveaways" ADD CONSTRAINT "giveaways_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'giveaways_record_id_fkey') THEN
    ALTER TABLE "giveaways" ADD CONSTRAINT "giveaways_record_id_fkey"
      FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'giveaway_claims_giveaway_id_fkey') THEN
    ALTER TABLE "giveaway_claims" ADD CONSTRAINT "giveaway_claims_giveaway_id_fkey"
      FOREIGN KEY ("giveaway_id") REFERENCES "giveaways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'giveaway_claims_claimer_user_id_fkey') THEN
    ALTER TABLE "giveaway_claims" ADD CONSTRAINT "giveaway_claims_claimer_user_id_fkey"
      FOREIGN KEY ("claimer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transaction_ratings_giveaway_id_fkey') THEN
    ALTER TABLE "transaction_ratings" ADD CONSTRAINT "transaction_ratings_giveaway_id_fkey"
      FOREIGN KEY ("giveaway_id") REFERENCES "giveaways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transaction_ratings_rater_user_id_fkey') THEN
    ALTER TABLE "transaction_ratings" ADD CONSTRAINT "transaction_ratings_rater_user_id_fkey"
      FOREIGN KEY ("rater_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transaction_ratings_ratee_user_id_fkey') THEN
    ALTER TABLE "transaction_ratings" ADD CONSTRAINT "transaction_ratings_ratee_user_id_fkey"
      FOREIGN KEY ("ratee_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_referrer_user_id_fkey') THEN
    ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_user_id_fkey"
      FOREIGN KEY ("referrer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_referred_user_id_fkey') THEN
    ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_fkey"
      FOREIGN KEY ("referred_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'households_owner_user_id_fkey') THEN
    ALTER TABLE "households" ADD CONSTRAINT "households_owner_user_id_fkey"
      FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'household_members_household_id_fkey') THEN
    ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_fkey"
      FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'household_members_user_id_fkey') THEN
    ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- --- Rename indexes to match their current @@index declarations (guarded: --
-- --- only rename when the old name exists and the new one doesn't yet) -----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'api_errors_created_at_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'api_errors_createdAt_idx') THEN
    ALTER INDEX "api_errors_created_at_idx" RENAME TO "api_errors_createdAt_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'deals_country_status_score_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'deals_country_status_score_created_at_idx') THEN
    ALTER INDEX "deals_country_status_score_idx" RENAME TO "deals_country_status_score_created_at_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'deals_status_score_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'deals_status_score_created_at_idx') THEN
    ALTER INDEX "deals_status_score_idx" RENAME TO "deals_status_score_created_at_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'giveaways_country_status_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'giveaways_country_status_created_at_idx') THEN
    ALTER INDEX "giveaways_country_status_idx" RENAME TO "giveaways_country_status_created_at_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'household_members_user_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'household_members_user_id_idx') THEN
    ALTER INDEX "household_members_user_idx" RENAME TO "household_members_user_id_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'households_owner_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'households_owner_user_id_idx') THEN
    ALTER INDEX "households_owner_idx" RENAME TO "households_owner_user_id_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'records_household_status_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'records_household_id_status_expiry_date_idx') THEN
    ALTER INDEX "records_household_status_idx" RENAME TO "records_household_id_status_expiry_date_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'records_household_updated_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'records_household_id_updated_at_idx') THEN
    ALTER INDEX "records_household_updated_idx" RENAME TO "records_household_id_updated_at_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'referrals_referrer_status_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'referrals_referrer_user_id_status_idx') THEN
    ALTER INDEX "referrals_referrer_status_idx" RENAME TO "referrals_referrer_user_id_status_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'transaction_ratings_ratee_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'transaction_ratings_ratee_user_id_idx') THEN
    ALTER INDEX "transaction_ratings_ratee_idx" RENAME TO "transaction_ratings_ratee_user_id_idx";
  END IF;
END $$;
