-- Widen position checks on product_photos and product_edit_photos from <= 4 to <= 19
-- to support platform-configurable photo upload limits up to 20 photos per item.

ALTER TABLE "product_photos" DROP CONSTRAINT "product_photos_position_check";
ALTER TABLE "product_photos"
  ADD CONSTRAINT "product_photos_position_check"
  CHECK ("position" >= 0 AND "position" <= 19);

ALTER TABLE "product_edit_photos" DROP CONSTRAINT "product_edit_photos_position_check";
ALTER TABLE "product_edit_photos"
  ADD CONSTRAINT "product_edit_photos_position_check"
  CHECK ("position" >= 0 AND "position" <= 19);
