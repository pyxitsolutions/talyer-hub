ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_vehicles_shop_active
  ON vehicles (shop_id, is_active)
  WHERE is_active = true;
