ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_customers_shop_active
  ON customers (shop_id, is_active)
  WHERE is_active = true;
