-- Ensure shop_status supports pending, active, disabled, and rejected.
-- Safe to run even if 011/015 were partially applied.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_status') THEN
    CREATE TYPE shop_status AS ENUM ('pending', 'active', 'disabled', 'rejected');
  END IF;
END $$;

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS status shop_status NOT NULL DEFAULT 'pending';

ALTER TYPE shop_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE shop_status ADD VALUE IF NOT EXISTS 'rejected';

ALTER TABLE shops
  ALTER COLUMN status SET DEFAULT 'pending';

-- Do not bulk-convert disabled shops here. Migration 011 activated existing shops
-- without approved_at, so "disabled + approved_at IS NULL" includes real deactivations.
-- Use Platform Admin reject/approve, or 017_fix_rejected_backfill.sql if 016 was run.
