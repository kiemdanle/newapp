-- Backfill created_by_user_id from the earliest pantry record referencing each product
UPDATE "products"
SET "created_by_user_id" = (
  SELECT r."user_id"
  FROM "records" r
  WHERE r."product_id" = "products"."id"
  ORDER BY r."created_at" ASC
  LIMIT 1
)
WHERE "created_by_user_id" IS NULL
  AND EXISTS (
    SELECT 1 FROM "records" r WHERE r."product_id" = "products"."id"
  );
