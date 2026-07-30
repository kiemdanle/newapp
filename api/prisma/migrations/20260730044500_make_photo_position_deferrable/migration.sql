-- Photo reorder cannot be expressed as a single-statement UPDATE against an
-- immediate UNIQUE(product_id, position)/UNIQUE(product_edit_id, position): swapping
-- two positions in one UPDATE briefly collides on the target position, and the
-- position CHECK (0..4) leaves no unused value to stage through. Delete-then-reinsert
-- is not viable either — `product_edit_photos_source_product_photo_id_fkey` is
-- `ON DELETE RESTRICT` by design (Phase 4's rebase/supersede recovery model depends on
-- photo row identity surviving a reorder). Making both unique constraints deferrable
-- lets a reorder transaction `SET CONSTRAINTS ... DEFERRED` and write the whole target
-- order in one transaction, checked only at commit.
--
-- PostgreSQL's `ALTER TABLE ... ALTER CONSTRAINT` only changes deferrability for
-- foreign key constraints; a UNIQUE constraint's deferrability can only be set at
-- creation, so this drops and re-adds each constraint. No foreign key references
-- either constraint (both FKs into these tables target the primary key `id`), so
-- nothing else is affected by the drop.
ALTER TABLE "product_photos" DROP CONSTRAINT "product_photos_product_id_position_key";
ALTER TABLE "product_photos"
  ADD CONSTRAINT "product_photos_product_id_position_key"
  UNIQUE ("product_id", "position") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "product_edit_photos" DROP CONSTRAINT "product_edit_photos_product_edit_id_position_key";
ALTER TABLE "product_edit_photos"
  ADD CONSTRAINT "product_edit_photos_product_edit_id_position_key"
  UNIQUE ("product_edit_id", "position") DEFERRABLE INITIALLY IMMEDIATE;
