DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_status') THEN
    CREATE TYPE referral_status AS ENUM ('pending', 'activated');
  END IF;
END $$;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES users(id);
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status referral_status NOT NULL DEFAULT 'pending',
  signup_ip TEXT,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referrals_no_self_referral_check CHECK (referrer_user_id <> referred_user_id)
);
CREATE INDEX IF NOT EXISTS referrals_referrer_status_idx ON referrals(referrer_user_id, status);
