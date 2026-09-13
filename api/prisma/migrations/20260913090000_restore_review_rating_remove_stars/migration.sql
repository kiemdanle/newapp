-- Backfill rating where null based on historical stars
UPDATE "reviews"
SET "rating" = CASE
  WHEN "stars" >= 4 THEN 'buy_again'::"review_rating"
  WHEN "stars" = 3 THEN 'buy_again_on_sale'::"review_rating"
  ELSE 'wont_buy'::"review_rating"
END
WHERE "rating" IS NULL;

-- Make rating non-nullable
ALTER TABLE "reviews" ALTER COLUMN "rating" SET NOT NULL;

-- Drop check constraint on stars if exists
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_stars_check";

-- Drop stars column from reviews
ALTER TABLE "reviews" DROP COLUMN IF EXISTS "stars";

-- Drop average_rating column from products
ALTER TABLE "products" DROP COLUMN IF EXISTS "average_rating";
