-- TalyerHub — Seed inventory: oils, filters, and common parts
--
-- Inserts items for EVERY shop in the database.
-- Safe to re-run: updates name/prices/stock on conflict (same part_number per shop).
--
-- How to run:
--   Supabase Dashboard → SQL Editor → paste → Run
--
-- Note: Prices are sample PHP values. Adjust cost_price / selling_price as needed.

INSERT INTO inventory_items (
  shop_id,
  part_number,
  part_name,
  category,
  quantity,
  cost_price,
  selling_price,
  reorder_level,
  supplier
)
SELECT
  s.id,
  v.part_number,
  v.part_name,
  v.category,
  v.quantity,
  v.cost_price,
  v.selling_price,
  v.reorder_level,
  v.supplier
FROM shops s
CROSS JOIN (
  VALUES
    -- ============================================================
    -- ENGINE OILS & FLUIDS
    -- ============================================================
    ('OIL-001', 'Engine Oil 5W-30 Synthetic (1L)', 'Oils', 40, 320.00, 550.00, 10, 'Petron / Castrol'),
    ('OIL-002', 'Engine Oil 5W-40 Semi-Synthetic (1L)', 'Oils', 35, 280.00, 480.00, 10, 'Petron / Castrol'),
    ('OIL-003', 'Engine Oil 10W-40 Mineral (1L)', 'Oils', 50, 220.00, 380.00, 12, 'Petron / Caltex'),
    ('OIL-004', 'Engine Oil 0W-20 Fully Synthetic (1L)', 'Oils', 25, 450.00, 750.00, 8, 'Mobil / Toyota Genuine'),
    ('OIL-005', 'Engine Oil 5W-30 Diesel (1L)', 'Oils', 20, 350.00, 580.00, 8, 'Shell / Petron'),
    ('OIL-006', 'ATF Transmission Fluid (1L)', 'Oils', 24, 380.00, 650.00, 6, 'Toyota / Honda ATF'),
    ('OIL-007', 'CVT Fluid (1L)', 'Oils', 18, 420.00, 720.00, 6, 'Nissan / Honda CVT'),
    ('OIL-008', 'Brake Fluid DOT 4 (500ml)', 'Oils', 30, 120.00, 220.00, 8, 'Bendix / ATE'),
    ('OIL-009', 'Coolant / Antifreeze (1L)', 'Oils', 28, 150.00, 280.00, 8, 'Prestone / Toyota LL'),
    ('OIL-010', 'Power Steering Fluid (1L)', 'Oils', 15, 180.00, 320.00, 5, 'Idemitsu / Honda PSF'),

    -- ============================================================
    -- FILTERS
    -- ============================================================
    ('FLT-001', 'Oil Filter — Universal / Small', 'Filters', 45, 85.00, 180.00, 10, 'Sakura / Denso'),
    ('FLT-002', 'Oil Filter — Toyota / Honda Common', 'Filters', 40, 120.00, 250.00, 10, 'OEM / Sakura'),
    ('FLT-003', 'Oil Filter — Diesel / Pickup', 'Filters', 20, 180.00, 350.00, 6, 'Sakura / Mann'),
    ('FLT-004', 'Air Filter — Panel Type', 'Filters', 30, 150.00, 320.00, 8, 'Sakura / Denso'),
    ('FLT-005', 'Air Filter — Toyota Vios / Avanza', 'Filters', 25, 180.00, 380.00, 6, 'OEM / Sakura'),
    ('FLT-006', 'Air Filter — Honda City / Civic', 'Filters', 25, 190.00, 400.00, 6, 'OEM / Sakura'),
    ('FLT-007', 'Cabin Air Filter', 'Filters', 22, 200.00, 420.00, 6, 'Sakura / Denso'),
    ('FLT-008', 'Fuel Filter — Gasoline Inline', 'Filters', 15, 250.00, 480.00, 5, 'Sakura / Denso'),
    ('FLT-009', 'Fuel Filter — Diesel', 'Filters', 12, 320.00, 580.00, 4, 'Mann / Sakura'),
    ('FLT-010', 'Transmission Filter (Internal)', 'Filters', 10, 450.00, 850.00, 3, 'OEM / Aftermarket'),

    -- ============================================================
    -- MAINTENANCE PARTS
    -- ============================================================
    ('PRT-001', 'Spark Plug — Standard (pc)', 'Parts', 60, 120.00, 250.00, 12, 'NGK / Denso'),
    ('PRT-002', 'Spark Plug — Iridium (pc)', 'Parts', 40, 350.00, 650.00, 8, 'NGK Iridium'),
    ('PRT-003', 'Spark Plug Set (4 pcs)', 'Parts', 20, 480.00, 900.00, 5, 'NGK / Denso'),
    ('PRT-004', 'Wiper Blade 14 inch', 'Parts', 25, 90.00, 180.00, 6, 'Bosch / PIAA'),
    ('PRT-005', 'Wiper Blade 18 inch', 'Parts', 25, 110.00, 220.00, 6, 'Bosch / PIAA'),
    ('PRT-006', 'Wiper Blade 24 inch', 'Parts', 20, 130.00, 260.00, 5, 'Bosch / PIAA'),
    ('PRT-007', 'Drive Belt / Fan Belt', 'Parts', 18, 280.00, 520.00, 5, 'Gates / Bando'),
    ('PRT-008', 'Timing Belt Kit', 'Parts', 8, 1800.00, 3200.00, 2, 'Gates / OEM'),
    ('PRT-009', 'Brake Pads — Front Set', 'Parts', 16, 650.00, 1200.00, 4, 'Akebono / Bendix'),
    ('PRT-010', 'Brake Pads — Rear Set', 'Parts', 16, 550.00, 1000.00, 4, 'Akebono / Bendix'),
    ('PRT-011', 'Brake Disc — Front (pair)', 'Parts', 8, 2200.00, 3800.00, 2, 'Brembo / OEM'),
    ('PRT-012', 'Brake Shoe — Rear Set', 'Parts', 12, 480.00, 900.00, 3, 'Akebono / OEM'),
    ('PRT-013', 'Car Battery 45Ah (NS40)', 'Parts', 10, 2800.00, 4500.00, 2, 'Motolite / Amaron'),
    ('PRT-014', 'Car Battery 55Ah (NS60)', 'Parts', 8, 3500.00, 5500.00, 2, 'Motolite / Amaron'),
    ('PRT-015', 'Radiator Hose — Upper', 'Parts', 10, 350.00, 650.00, 3, 'Gates / OEM'),
    ('PRT-016', 'Radiator Hose — Lower', 'Parts', 10, 350.00, 650.00, 3, 'Gates / OEM'),
    ('PRT-017', 'Radiator Cap 1.1 bar', 'Parts', 15, 180.00, 350.00, 4, 'OEM / Stant'),
    ('PRT-018', 'Thermostat', 'Parts', 12, 280.00, 520.00, 4, 'OEM / Wahler'),
    ('PRT-019', 'Water Pump', 'Parts', 6, 1800.00, 3200.00, 2, 'OEM / GMB'),
    ('PRT-020', 'Wheel Lug Nut (pc)', 'Parts', 50, 35.00, 80.00, 10, 'Generic'),
    ('PRT-021', 'Gasket Maker RTV (tube)', 'Parts', 20, 120.00, 250.00, 5, 'ThreeBond / Permatex'),
    ('PRT-022', 'Drain Plug Washer / Gasket (pc)', 'Parts', 100, 8.00, 25.00, 20, 'OEM / Generic'),
    ('PRT-023', 'Fuel Injector Cleaner (300ml)', 'Parts', 24, 180.00, 350.00, 6, 'Liqui Moly / STP'),
    ('PRT-024', 'Throttle Body Cleaner (400ml)', 'Parts', 18, 220.00, 420.00, 5, 'CRC / Liqui Moly')
) AS v(
  part_number,
  part_name,
  category,
  quantity,
  cost_price,
  selling_price,
  reorder_level,
  supplier
)
ON CONFLICT (shop_id, part_number) DO UPDATE SET
  part_name = EXCLUDED.part_name,
  category = EXCLUDED.category,
  quantity = EXCLUDED.quantity,
  cost_price = EXCLUDED.cost_price,
  selling_price = EXCLUDED.selling_price,
  reorder_level = EXCLUDED.reorder_level,
  supplier = EXCLUDED.supplier,
  updated_at = NOW();

-- Optional: verify per shop
-- SELECT shop_id, category, COUNT(*) AS items
-- FROM inventory_items
-- WHERE part_number LIKE 'OIL-%' OR part_number LIKE 'FLT-%' OR part_number LIKE 'PRT-%'
-- GROUP BY shop_id, category
-- ORDER BY shop_id, category;
