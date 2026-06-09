-- Add optional category, price, store to records (drives dashboard filter + add-record accordion)
ALTER TABLE records ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE records ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);
ALTER TABLE records ADD COLUMN IF NOT EXISTS store TEXT;
