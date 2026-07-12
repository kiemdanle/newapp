ALTER TABLE "users" ALTER COLUMN "themePreference" SET DEFAULT 'expyrico';

UPDATE "users"
SET "themePreference" = 'expyrico'
WHERE "themePreference" = 'aurora';
