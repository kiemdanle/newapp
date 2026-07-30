-- `is_legacy` defaulted to `true` when added (migration
-- 20260726160100_expand_product_drafts_photos_and_moderation) so the backfill of
-- pre-Phase-1 historical rows never needed an explicit value. That default also meant
-- every *future* insert was silently exempt from the one-open-edit partial unique
-- index unless the writer remembered to pass `isLegacy: false` explicitly — a fail-open
-- trap. Every current writer (`api/src/routes/products/patch.ts`,
-- `api/src/routes/admin/products/pending-resolve.ts`) is now explicit about
-- `isLegacy`, so flipping the default only removes the trap for future writers; it
-- does not change the meaning of any existing row.
ALTER TABLE "product_edits" ALTER COLUMN "is_legacy" SET DEFAULT false;
