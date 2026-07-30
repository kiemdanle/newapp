-- DEPLOY GATE — do not run this migration until every precondition below holds:
--   1. This migration A (`..._expand_product_drafts_photos_and_moderation`) and Phase 1
--      compatibility readers are fully deployed, and every pre-compatibility API
--      instance has drained.
--   2. Phase 2's active-only legacy lookup and `report_hidden` report writers are fully
--      deployed — no deployed report writer still emits legacy `pending`.
--   3. `product_creation.mode` has stayed `off` continuously since before migration A,
--      so no row with `status = 'pending'` can be a creator submission.
-- Phase 8 owns running `prisma migrate deploy` for this file. Running it earlier
-- misclassifies nothing structurally invalid, but the preconditions above cannot be
-- verified from SQL alone (deployed-writer state, rollout mode history) — the DO block
-- below only catches the one precondition that IS DB-checkable: no `pending` row may
-- carry a private-draft submission timestamp.
--
-- Never renames or drops an enum value; only reclassifies existing `pending` rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "products" WHERE "status" = 'pending' AND "submitted_at" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'refusing to classify pending products as report_hidden: at least one pending row has a submission timestamp (creator-submitted, not legacy report-hidden)';
  END IF;
END $$;

UPDATE "products" SET "status" = 'report_hidden' WHERE "status" = 'pending';
