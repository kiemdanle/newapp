-- DEPLOY GATE — do not run this migration until every precondition below holds:
--   1. This migration A (`..._expand_product_drafts_photos_and_moderation`) and Phase 1
--      compatibility readers are fully deployed, and every pre-compatibility API
--      instance has drained.
--   2. Phase 2's active-only legacy lookup and `report_hidden` report writers are fully
--      deployed — no deployed report writer still emits legacy `pending`.
--   3. `product_creation.mode` has stayed `off` continuously since before migration A,
--      so no row with `status = 'pending'` can be a creator submission.
-- Phase 8 owns running `prisma migrate deploy` for this file. The preflight below
-- checks every precondition that IS DB-checkable: current `product_creation.mode`,
-- and every DB-checkable lifecycle/activity marker that would prove a `pending` row
-- is a creator submission rather than pre-feature report-hidden provenance. It cannot
-- verify deployed-writer state or rollout-mode *history* (whether mode ever flipped
-- on and back off) — those remain operator responsibilities per the preconditions
-- above.
--
-- Never renames or drops an enum value; only reclassifies existing `pending` rows.
DO $$
BEGIN
  IF (SELECT "value" ->> 'mode' FROM "settings" WHERE "key" = 'product_creation') IS DISTINCT FROM 'off' THEN
    RAISE EXCEPTION 'refusing to classify pending products as report_hidden: product_creation.mode is not off';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "products" WHERE "status" = 'pending' AND "submitted_at" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'refusing to classify pending products as report_hidden: at least one pending row has a submission timestamp (creator-submitted, not legacy report-hidden)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "products"
    WHERE "status" = 'pending' AND ("moderated_at" IS NOT NULL OR "moderated_by_user_id" IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'refusing to classify pending products as report_hidden: at least one pending row has a moderation marker (creator-submitted, not legacy report-hidden)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "products" WHERE "status" = 'pending' AND "version" > 1
  ) THEN
    RAISE EXCEPTION 'refusing to classify pending products as report_hidden: at least one pending row has version > 1 (creator-submitted, not legacy report-hidden)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "products" p
    WHERE p."status" = 'pending' AND EXISTS (SELECT 1 FROM "product_photos" ph WHERE ph."product_id" = p."id")
  ) THEN
    RAISE EXCEPTION 'refusing to classify pending products as report_hidden: at least one pending row has product_photos rows (creator-submitted, not legacy report-hidden)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "products" p
    WHERE p."status" = 'pending'
      AND EXISTS (SELECT 1 FROM "product_edits" pe WHERE pe."product_id" = p."id" AND NOT pe."is_legacy")
  ) THEN
    RAISE EXCEPTION 'refusing to classify pending products as report_hidden: at least one pending row has a non-legacy product_edits row (creator-submitted, not legacy report-hidden)';
  END IF;
END $$;

UPDATE "products" SET "status" = 'report_hidden' WHERE "status" = 'pending';
