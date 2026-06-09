-- Add 'deal' to ReportTargetType enum (must be in its own migration per Postgres enum rules)
ALTER TYPE "ReportTargetType" ADD VALUE IF NOT EXISTS 'deal';
