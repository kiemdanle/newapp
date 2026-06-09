-- Migrate reviews from taste/value ratings to three-option rating enum (2026-06-08 revision §2.6)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_rating') THEN
    CREATE TYPE review_rating AS ENUM ('buy_again', 'buy_again_on_sale', 'wont_buy');
  END IF;
END $$;

ALTER TABLE reviews
  DROP COLUMN IF EXISTS taste_rating,
  DROP COLUMN IF EXISTS value_rating,
  DROP COLUMN IF EXISTS upvote_count,
  DROP COLUMN IF EXISTS downvote_count;

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS rating review_rating NOT NULL DEFAULT 'buy_again';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS helpful_count INT NOT NULL DEFAULT 0;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS not_helpful_count INT NOT NULL DEFAULT 0;

-- Remove old denorm columns from products (replaced by three-option tallies already in M1)
ALTER TABLE products DROP COLUMN IF EXISTS taste_avg;
ALTER TABLE products DROP COLUMN IF EXISTS value_avg;

-- Migrate review_votes.value from int (-1/1) to text ('helpful'/'not_helpful')
ALTER TABLE review_votes ALTER COLUMN value TYPE TEXT USING CASE WHEN value = '1' THEN 'helpful' WHEN value = '-1' THEN 'not_helpful' ELSE 'helpful' END;
