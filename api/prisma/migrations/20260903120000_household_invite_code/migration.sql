ALTER TABLE households ADD COLUMN IF NOT EXISTS invite_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS households_invite_code_idx ON households(invite_code);
