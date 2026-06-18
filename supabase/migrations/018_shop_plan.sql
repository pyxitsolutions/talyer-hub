-- Shop subscription plan: basic (₱349) or pro (₱649)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_plan') THEN
    CREATE TYPE shop_plan AS ENUM ('basic', 'pro');
  END IF;
END $$;

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS plan shop_plan NOT NULL DEFAULT 'basic';

-- Existing active shops keep full access until manually changed.
UPDATE shops
SET plan = 'pro'
WHERE status = 'active';
