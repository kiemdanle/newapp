-- M6 giveaways migration
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'giveaway_status') THEN
    CREATE TYPE giveaway_status AS ENUM ('open','claimed','handed_off','completed','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'giveaway_claim_status') THEN
    CREATE TYPE giveaway_claim_status AS ENUM ('requested','selected','rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_rater_role') THEN
    CREATE TYPE transaction_rater_role AS ENUM ('giver','recipient');
  END IF;
END $$;
ALTER TABLE users ADD COLUMN IF NOT EXISTS giver_rating_avg NUMERIC(3,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS recipient_rating_avg NUMERIC(3,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS transaction_count INT NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS giveaways (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), giver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, product_id UUID REFERENCES products(id), record_id UUID REFERENCES records(id), title TEXT NOT NULL, description TEXT, photo_url TEXT, location_text TEXT NOT NULL, country CHAR(2), status giveaway_status NOT NULL DEFAULT 'open', claim_expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), handed_off_at TIMESTAMPTZ, confirmed_at TIMESTAMPTZ, completed_at TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS giveaways_country_status_idx ON giveaways(country, status, created_at DESC);
CREATE TABLE IF NOT EXISTS giveaway_claims (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE, claimer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, pickup_note TEXT, status giveaway_claim_status NOT NULL DEFAULT 'requested', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(giveaway_id, claimer_user_id));
CREATE UNIQUE INDEX IF NOT EXISTS giveaway_claims_one_selected ON giveaway_claims(giveaway_id) WHERE status='selected';
CREATE TABLE IF NOT EXISTS transaction_ratings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE, rater_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, ratee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, rater_role transaction_rater_role NOT NULL, stars SMALLINT NOT NULL CHECK(stars BETWEEN 1 AND 5), comment TEXT, revealed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(giveaway_id, rater_user_id));
CREATE INDEX IF NOT EXISTS transaction_ratings_ratee_idx ON transaction_ratings(ratee_user_id);
CREATE TABLE IF NOT EXISTS notification_outbox (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, template_key TEXT NOT NULL, payload JSONB NOT NULL, dispatched_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
