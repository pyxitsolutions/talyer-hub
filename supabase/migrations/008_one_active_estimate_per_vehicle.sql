-- Enforce one open (draft/approved) estimate per customer vehicle at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS idx_repair_estimates_one_active_per_vehicle
  ON repair_estimates (shop_id, customer_id, vehicle_id)
  WHERE status IN ('draft', 'approved');
