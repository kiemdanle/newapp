-- AlterTable reviews add stars column with default 5
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "stars" SMALLINT NOT NULL DEFAULT 5;

-- Make rating nullable in reviews for transition
ALTER TABLE "reviews" ALTER COLUMN "rating" DROP NOT NULL;

-- Backfill stars based on historical rating
UPDATE "reviews" SET "stars" = 5 WHERE "rating" = 'buy_again';
UPDATE "reviews" SET "stars" = 3 WHERE "rating" = 'buy_again_on_sale';
UPDATE "reviews" SET "stars" = 1 WHERE "rating" = 'wont_buy';

-- AlterTable products add average_rating column
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "average_rating" DECIMAL(3, 2) NOT NULL DEFAULT 0.00;

-- Add CHECK constraint on stars (1 to 5)
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_stars_check" CHECK ("stars" >= 1 AND "stars" <= 5);
