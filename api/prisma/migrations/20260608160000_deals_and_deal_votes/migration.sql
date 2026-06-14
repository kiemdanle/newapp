DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_status') THEN
    CREATE TYPE deal_status AS ENUM ('visible', 'hidden', 'deleted');
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price NUMERIC(10,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  store_name TEXT NOT NULL,
  photo_url TEXT,
  expiry_date DATE,
  note TEXT,
  country CHAR(2),
  upvote_count INT NOT NULL DEFAULT 0,
  downvote_count INT NOT NULL DEFAULT 0,
  score NUMERIC(7,6) NOT NULL DEFAULT 0,
  status deal_status NOT NULL DEFAULT 'visible',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS deal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, deal_id)
);
CREATE INDEX IF NOT EXISTS deals_status_score_idx ON deals(status, score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS deals_country_status_score_idx ON deals(country, status, score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS deals_product_id_idx ON deals(product_id);
CREATE INDEX IF NOT EXISTS deal_votes_deal_id_idx ON deal_votes(deal_id);
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deals_price_nonneg_check' AND conrelid = 'deals'::regclass
  ) THEN
    ALTER TABLE deals ADD CONSTRAINT deals_price_nonneg_check CHECK (price >= 0);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deals_store_name_len_check' AND conrelid = 'deals'::regclass
  ) THEN
    ALTER TABLE deals ADD CONSTRAINT deals_store_name_len_check CHECK (char_length(store_name) BETWEEN 1 AND 120);
  END IF;
END $$;
