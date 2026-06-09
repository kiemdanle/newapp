DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'household_role') THEN
    CREATE TYPE household_role AS ENUM ('owner', 'member');
  END IF;
END $$;
ALTER TABLE records ADD COLUMN IF NOT EXISTS household_id UUID;
CREATE TABLE IF NOT EXISTS households (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS households_owner_idx ON households(owner_user_id);
CREATE TABLE IF NOT EXISTS household_members (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, role household_role NOT NULL DEFAULT 'member', joined_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(household_id, user_id));
CREATE INDEX IF NOT EXISTS household_members_user_idx ON household_members(user_id);
ALTER TABLE records ADD FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS records_household_status_idx ON records(household_id, status, expiry_date);
CREATE INDEX IF NOT EXISTS records_household_updated_idx ON records(household_id, updated_at);
