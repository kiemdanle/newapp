-- Add food expiry_date to giveaways table
ALTER TABLE giveaways ADD COLUMN IF NOT EXISTS expiry_date TEXT;
