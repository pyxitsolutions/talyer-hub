-- =============================================================================
-- TalyerHub — Complete database setup (fresh Supabase project)
-- =============================================================================
-- Run this ONCE in Supabase → SQL Editor on a NEW empty project.
-- Combines migrations 001 through 018 (excludes 019_shop_trial — manual billing).
--
-- Do NOT run if you already applied the individual migration files (duplicate errors).
-- Do NOT run on production with existing data unless you know what you are doing.
--
-- After this file succeeds:
--   1. Authentication → Email ON, Confirm email OFF
--   2. Set Site URL + redirect URLs (see DEPLOYMENT.md)
--   3. Promote super admin (SQL in DEPLOYMENT.md)
-- =============================================================================


-- ----------------------------------------------------------------------------- 
-- 001_initial_schema.sql
-- ----------------------------------------------------------------------------- 

-- TalyerHub - Multi-Tenant Schema
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- SHOPS (Tenants)
-- ============================================================
CREATE TABLE shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  contact_number TEXT,
  email TEXT,
  address TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (id, name, description) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'owner', 'Shop owner with full access'),
  ('a0000000-0000-0000-0000-000000000002', 'service_advisor', 'Service advisor managing estimates and customers'),
  ('a0000000-0000-0000-0000-000000000003', 'technician', 'Technician performing repairs'),
  ('a0000000-0000-0000-0000-000000000004', 'cashier', 'Cashier handling billing and payments'),
  ('a0000000-0000-0000-0000-000000000005', 'super_admin', 'Platform administrator with cross-shop access')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USER ROLES (RBAC)
-- ============================================================
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role_id, shop_id)
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  contact_number TEXT,
  address TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id, customer_number)
);

-- ============================================================
-- VEHICLES
-- ============================================================
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plate_number TEXT NOT NULL,
  brand TEXT NOT NULL,
  unit TEXT,
  model TEXT NOT NULL,
  year_model INTEGER,
  chassis_number TEXT,
  engine_number TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id, plate_number)
);

-- ============================================================
-- REPAIR ESTIMATES
-- ============================================================
CREATE TYPE estimate_status AS ENUM ('draft', 'approved', 'rejected');

CREATE TABLE repair_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  estimate_number TEXT NOT NULL,
  estimate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  chassis_number TEXT,
  engine_number TEXT,
  problem_description TEXT,
  repair_description TEXT,
  recommendation TEXT,
  technician_name TEXT,
  labor_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  parts_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  status estimate_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id, estimate_number)
);

CREATE TABLE repair_estimate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  estimate_id UUID NOT NULL REFERENCES repair_estimates(id) ON DELETE CASCADE,
  part_name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  inventory_item_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- JOB ORDERS
-- ============================================================
CREATE TYPE job_order_status AS ENUM ('pending', 'ongoing', 'completed', 'released');

CREATE TABLE job_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  job_order_number TEXT NOT NULL,
  estimate_id UUID REFERENCES repair_estimates(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  assigned_technician TEXT,
  date_started DATE,
  date_completed DATE,
  status job_order_status NOT NULL DEFAULT 'pending',
  repair_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id, job_order_number)
);

CREATE TABLE job_order_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  job_order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID,
  part_name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TYPE payment_status AS ENUM ('unpaid', 'partial', 'paid');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'bank_transfer', 'check', 'other');

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  job_order_id UUID REFERENCES job_orders(id) ON DELETE SET NULL,
  chassis_number TEXT,
  engine_number TEXT,
  repair_description TEXT,
  recommendation TEXT,
  parts_used TEXT,
  labor_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  parts_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method payment_method,
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  technician_name TEXT,
  verification_code TEXT DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id, invoice_number)
);

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  inventory_item_id UUID,
  part_name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INVENTORY
-- ============================================================
CREATE TYPE inventory_transaction_type AS ENUM ('stock_in', 'stock_out', 'adjustment');

CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  part_number TEXT NOT NULL,
  part_name TEXT NOT NULL,
  category TEXT,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  reorder_level DECIMAL(10,2) NOT NULL DEFAULT 5,
  supplier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id, part_number)
);

CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  transaction_type inventory_transaction_type NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK for inventory_item_id in estimate items
ALTER TABLE repair_estimate_items
  ADD CONSTRAINT fk_estimate_items_inventory
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL;

ALTER TABLE job_order_parts
  ADD CONSTRAINT fk_job_order_parts_inventory
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL;

ALTER TABLE invoice_items
  ADD CONSTRAINT fk_invoice_items_inventory
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL;

-- ============================================================
-- UNITS RECEIVED
-- ============================================================
CREATE TYPE unit_category AS ENUM ('pms', 'minor_repair', 'general_repair', 'body_repair_paint');

CREATE TABLE units_received (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category unit_category NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  job_order_id UUID REFERENCES job_orders(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TYPE expense_category AS ENUM (
  'shop_expenses', 'food', 'kitchen_supplies', 'electricity', 'water',
  'internet', 'rent', 'salary_expenses', 'weekly_salary', 'monthly_salary', 'yearly_salary'
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category expense_category NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SALES RECORDS
-- ============================================================
CREATE TYPE sale_type AS ENUM ('parts', 'materials', 'labor');

CREATE TABLE sales_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sale_type sale_type NOT NULL,
  description TEXT,
  amount DECIMAL(12,2) NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_profiles_shop_id ON profiles(shop_id);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_shop_id ON user_roles(shop_id);
CREATE INDEX idx_customers_shop_id ON customers(shop_id);
CREATE INDEX idx_customers_full_name ON customers(shop_id, full_name);
CREATE INDEX idx_vehicles_shop_id ON vehicles(shop_id);
CREATE INDEX idx_vehicles_customer_id ON vehicles(customer_id);
CREATE INDEX idx_vehicles_plate ON vehicles(shop_id, plate_number);
CREATE INDEX idx_vehicles_chassis ON vehicles(shop_id, chassis_number);
CREATE INDEX idx_repair_estimates_shop_id ON repair_estimates(shop_id);
CREATE INDEX idx_repair_estimates_status ON repair_estimates(shop_id, status);
CREATE INDEX idx_job_orders_shop_id ON job_orders(shop_id);
CREATE INDEX idx_job_orders_status ON job_orders(shop_id, status);
CREATE INDEX idx_invoices_shop_id ON invoices(shop_id);
CREATE INDEX idx_invoices_payment_status ON invoices(shop_id, payment_status);
CREATE INDEX idx_invoices_date ON invoices(shop_id, invoice_date);
CREATE INDEX idx_inventory_items_shop_id ON inventory_items(shop_id);
CREATE INDEX idx_inventory_items_low_stock ON inventory_items(shop_id, quantity, reorder_level);
CREATE INDEX idx_inventory_transactions_item ON inventory_transactions(inventory_item_id);
CREATE INDEX idx_units_received_date ON units_received(shop_id, received_date);
CREATE INDEX idx_expenses_date ON expenses(shop_id, expense_date);
CREATE INDEX idx_sales_records_date ON sales_records(shop_id, sale_date);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON shops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON user_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_repair_estimates_updated_at BEFORE UPDATE ON repair_estimates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_repair_estimate_items_updated_at BEFORE UPDATE ON repair_estimate_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_job_orders_updated_at BEFORE UPDATE ON job_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_job_order_parts_updated_at BEFORE UPDATE ON job_order_parts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoice_items_updated_at BEFORE UPDATE ON invoice_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_transactions_updated_at BEFORE UPDATE ON inventory_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_units_received_updated_at BEFORE UPDATE ON units_received FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_records_updated_at BEFORE UPDATE ON sales_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- HELPER: Get user's shop_id
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_shop_id()
RETURNS UUID AS $$
  SELECT shop_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION user_has_shop_access(target_shop_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND shop_id = target_shop_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- INVENTORY DEDUCTION FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION deduct_inventory(
  p_shop_id UUID,
  p_inventory_item_id UUID,
  p_quantity DECIMAL,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE inventory_items
  SET quantity = quantity - p_quantity
  WHERE id = p_inventory_item_id AND shop_id = p_shop_id;

  INSERT INTO inventory_transactions (
    shop_id, inventory_item_id, transaction_type, quantity,
    reference_type, reference_id, created_by
  ) VALUES (
    p_shop_id, p_inventory_item_id, 'stock_out', p_quantity,
    p_reference_type, p_reference_id, p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------- 
-- 002_rls_policies.sql
-- ----------------------------------------------------------------------------- 

-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_order_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE units_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;

-- SHOPS: users can only see their own shop
CREATE POLICY "Users can view own shop" ON shops
  FOR SELECT USING (id = get_user_shop_id());

CREATE POLICY "Owners can update own shop" ON shops
  FOR UPDATE USING (id = get_user_shop_id());

-- ROLES: all authenticated users can read roles
CREATE POLICY "Authenticated users can read roles" ON roles
  FOR SELECT TO authenticated USING (true);

-- PROFILES
CREATE POLICY "Users can view profiles in same shop" ON profiles
  FOR SELECT USING (shop_id = get_user_shop_id() OR id = auth.uid());

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- USER ROLES
CREATE POLICY "Users can view roles in same shop" ON user_roles
  FOR SELECT USING (shop_id = get_user_shop_id());

-- CUSTOMERS
CREATE POLICY "Shop access customers select" ON customers
  FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access customers insert" ON customers
  FOR INSERT WITH CHECK (shop_id = get_user_shop_id());
CREATE POLICY "Shop access customers update" ON customers
  FOR UPDATE USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access customers delete" ON customers
  FOR DELETE USING (shop_id = get_user_shop_id());

-- VEHICLES
CREATE POLICY "Shop access vehicles select" ON vehicles
  FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access vehicles insert" ON vehicles
  FOR INSERT WITH CHECK (shop_id = get_user_shop_id());
CREATE POLICY "Shop access vehicles update" ON vehicles
  FOR UPDATE USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access vehicles delete" ON vehicles
  FOR DELETE USING (shop_id = get_user_shop_id());

-- REPAIR ESTIMATES
CREATE POLICY "Shop access estimates select" ON repair_estimates
  FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access estimates insert" ON repair_estimates
  FOR INSERT WITH CHECK (shop_id = get_user_shop_id());
CREATE POLICY "Shop access estimates update" ON repair_estimates
  FOR UPDATE USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access estimates delete" ON repair_estimates
  FOR DELETE USING (shop_id = get_user_shop_id());

-- REPAIR ESTIMATE ITEMS
CREATE POLICY "Shop access estimate items select" ON repair_estimate_items
  FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access estimate items insert" ON repair_estimate_items
  FOR INSERT WITH CHECK (shop_id = get_user_shop_id());
CREATE POLICY "Shop access estimate items update" ON repair_estimate_items
  FOR UPDATE USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access estimate items delete" ON repair_estimate_items
  FOR DELETE USING (shop_id = get_user_shop_id());

-- JOB ORDERS
CREATE POLICY "Shop access job orders select" ON job_orders
  FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access job orders insert" ON job_orders
  FOR INSERT WITH CHECK (shop_id = get_user_shop_id());
CREATE POLICY "Shop access job orders update" ON job_orders
  FOR UPDATE USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access job orders delete" ON job_orders
  FOR DELETE USING (shop_id = get_user_shop_id());

-- JOB ORDER PARTS
CREATE POLICY "Shop access job order parts select" ON job_order_parts
  FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access job order parts insert" ON job_order_parts
  FOR INSERT WITH CHECK (shop_id = get_user_shop_id());
CREATE POLICY "Shop access job order parts update" ON job_order_parts
  FOR UPDATE USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access job order parts delete" ON job_order_parts
  FOR DELETE USING (shop_id = get_user_shop_id());

-- INVOICES
CREATE POLICY "Shop access invoices select" ON invoices
  FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access invoices insert" ON invoices
  FOR INSERT WITH CHECK (shop_id = get_user_shop_id());
CREATE POLICY "Shop access invoices update" ON invoices
  FOR UPDATE USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access invoices delete" ON invoices
  FOR DELETE USING (shop_id = get_user_shop_id());

-- INVOICE ITEMS
CREATE POLICY "Shop access invoice items select" ON invoice_items
  FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access invoice items insert" ON invoice_items
  FOR INSERT WITH CHECK (shop_id = get_user_shop_id());
CREATE POLICY "Shop access invoice items update" ON invoice_items
  FOR UPDATE USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access invoice items delete" ON invoice_items
  FOR DELETE USING (shop_id = get_user_shop_id());

-- INVENTORY ITEMS
CREATE POLICY "Shop access inventory select" ON inventory_items
  FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access inventory insert" ON inventory_items
  FOR INSERT WITH CHECK (shop_id = get_user_shop_id());
CREATE POLICY "Shop access inventory update" ON inventory_items
  FOR UPDATE USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access inventory delete" ON inventory_items
  FOR DELETE USING (shop_id = get_user_shop_id());

-- INVENTORY TRANSACTIONS
CREATE POLICY "Shop access inventory tx select" ON inventory_transactions
  FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access inventory tx insert" ON inventory_transactions
  FOR INSERT WITH CHECK (shop_id = get_user_shop_id());

-- UNITS RECEIVED
CREATE POLICY "Shop access units select" ON units_received
  FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access units insert" ON units_received
  FOR INSERT WITH CHECK (shop_id = get_user_shop_id());
CREATE POLICY "Shop access units update" ON units_received
  FOR UPDATE USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access units delete" ON units_received
  FOR DELETE USING (shop_id = get_user_shop_id());

-- EXPENSES
CREATE POLICY "Shop access expenses select" ON expenses
  FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access expenses insert" ON expenses
  FOR INSERT WITH CHECK (shop_id = get_user_shop_id());
CREATE POLICY "Shop access expenses update" ON expenses
  FOR UPDATE USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access expenses delete" ON expenses
  FOR DELETE USING (shop_id = get_user_shop_id());

-- SALES RECORDS
CREATE POLICY "Shop access sales select" ON sales_records
  FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access sales insert" ON sales_records
  FOR INSERT WITH CHECK (shop_id = get_user_shop_id());
CREATE POLICY "Shop access sales update" ON sales_records
  FOR UPDATE USING (shop_id = get_user_shop_id());
CREATE POLICY "Shop access sales delete" ON sales_records
  FOR DELETE USING (shop_id = get_user_shop_id());


-- ----------------------------------------------------------------------------- 
-- 003_invoice_verification_index.sql
-- ----------------------------------------------------------------------------- 

-- Speed up public invoice verification lookups by QR code
CREATE INDEX IF NOT EXISTS idx_invoices_verification_code ON invoices(verification_code);


-- ----------------------------------------------------------------------------- 
-- 004_shop_logos_storage.sql
-- ----------------------------------------------------------------------------- 

-- Shop logo uploads (Supabase Storage)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-logos',
  'shop-logos',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read shop logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'shop-logos');

CREATE POLICY "Shop users upload own logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'shop-logos'
  AND (storage.foldername(name))[1] = get_user_shop_id()::text
);

CREATE POLICY "Shop users update own logo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'shop-logos'
  AND (storage.foldername(name))[1] = get_user_shop_id()::text
)
WITH CHECK (
  bucket_id = 'shop-logos'
  AND (storage.foldername(name))[1] = get_user_shop_id()::text
);

CREATE POLICY "Shop users delete own logo"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'shop-logos'
  AND (storage.foldername(name))[1] = get_user_shop_id()::text
);


-- ----------------------------------------------------------------------------- 
-- 005_shop_logos_bucket_fix.sql
-- ----------------------------------------------------------------------------- 

-- Update shop-logos bucket MIME types if migration 004 was already applied
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/svg+xml'
  ],
  file_size_limit = 2097152,
  public = true
WHERE id = 'shop-logos';


-- ----------------------------------------------------------------------------- 
-- 006_estimate_released_status.sql
-- ----------------------------------------------------------------------------- 

-- Add released status to estimates (mirrors job order release / visit completion).
-- Must be in its own migration: PostgreSQL requires the new enum value to be
-- committed before it can be used in UPDATE/INSERT statements.
ALTER TYPE estimate_status ADD VALUE IF NOT EXISTS 'released';


-- ----------------------------------------------------------------------------- 
-- 007_backfill_estimate_released_status.sql
-- ----------------------------------------------------------------------------- 

-- Backfill: estimates linked to released job orders
UPDATE repair_estimates re
SET status = 'released'
FROM job_orders jo
WHERE jo.estimate_id = re.id
  AND jo.status = 'released'
  AND re.status IN ('draft', 'approved');


-- ----------------------------------------------------------------------------- 
-- 008_one_active_estimate_per_vehicle.sql
-- ----------------------------------------------------------------------------- 

-- Enforce one open (draft/approved) estimate per customer vehicle at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS idx_repair_estimates_one_active_per_vehicle
  ON repair_estimates (shop_id, customer_id, vehicle_id)
  WHERE status IN ('draft', 'approved');


-- ----------------------------------------------------------------------------- 
-- 009_job_order_labor_cost.sql
-- ----------------------------------------------------------------------------- 

-- Store labor from the source estimate on the job order
ALTER TABLE job_orders
  ADD COLUMN IF NOT EXISTS labor_cost DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE job_orders jo
SET labor_cost = re.labor_cost
FROM repair_estimates re
WHERE jo.estimate_id = re.id;


-- ----------------------------------------------------------------------------- 
-- 010_invoice_payment_reference.sql
-- ----------------------------------------------------------------------------- 

-- Non-cash payment details (reference number and payer account name)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payer_account_name TEXT;


-- ----------------------------------------------------------------------------- 
-- 011_super_admin_shop_approval.sql
-- ----------------------------------------------------------------------------- 

-- Platform admin: shop approval workflow and super admin flag.

CREATE TYPE shop_status AS ENUM ('pending', 'active', 'disabled');

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS status shop_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Existing shops remain usable without manual approval.
UPDATE shops SET status = 'active' WHERE status = 'pending';

INSERT INTO roles (id, name, description) VALUES
  ('a0000000-0000-0000-0000-000000000005', 'super_admin', 'Platform administrator with cross-shop access')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "Super admins can view all shops" ON shops
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Super admins can update all shops" ON shops
  FOR UPDATE USING (is_super_admin());

CREATE POLICY "Super admins can view all profiles" ON profiles
  FOR SELECT USING (is_super_admin());

-- Promote platform admin (also removes the admin's own auto-created shop):
-- UPDATE profiles SET is_super_admin = true WHERE email = 'you@example.com';
-- DELETE FROM shops
-- WHERE id IN (
--   SELECT shop_id FROM profiles
--   WHERE email = 'you@example.com' AND shop_id IS NOT NULL
-- );


-- ----------------------------------------------------------------------------- 
-- 012_activity_logs.sql
-- ----------------------------------------------------------------------------- 

-- Shop activity / audit log

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_name TEXT NOT NULL,
  actor_role TEXT,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_label TEXT,
  summary TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_shop_created ON activity_logs(shop_id, created_at DESC);
CREATE INDEX idx_activity_logs_shop_action ON activity_logs(shop_id, action_type);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop users can view activity logs" ON activity_logs
  FOR SELECT USING (shop_id = get_user_shop_id());

CREATE POLICY "Shop users can insert own activity logs" ON activity_logs
  FOR INSERT WITH CHECK (shop_id = get_user_shop_id() AND user_id = auth.uid());


-- ----------------------------------------------------------------------------- 
-- 013_vehicle_is_active.sql
-- ----------------------------------------------------------------------------- 

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_vehicles_shop_active
  ON vehicles (shop_id, is_active)
  WHERE is_active = true;


-- ----------------------------------------------------------------------------- 
-- 014_customer_is_active.sql
-- ----------------------------------------------------------------------------- 

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_customers_shop_active
  ON customers (shop_id, is_active)
  WHERE is_active = true;


-- ----------------------------------------------------------------------------- 
-- 015_shop_status_rejected.sql
-- ----------------------------------------------------------------------------- 

ALTER TYPE shop_status ADD VALUE IF NOT EXISTS 'rejected';


-- ----------------------------------------------------------------------------- 
-- 016_shop_status_complete.sql
-- ----------------------------------------------------------------------------- 

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


-- ----------------------------------------------------------------------------- 
-- 017_fix_rejected_backfill.sql
-- ----------------------------------------------------------------------------- 

-- Fix incorrect 016 backfill: operating shops were marked rejected because
-- migration 011 set status = active without filling approved_at, so later
-- admin deactivations looked like old registration rejects.

UPDATE shops s
SET
  status = CASE
    WHEN EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.shop_id = s.id
        AND p.is_active = true
        AND p.is_super_admin = false
    ) THEN 'active'::shop_status
    ELSE 'disabled'::shop_status
  END,
  approved_at = COALESCE(s.approved_at, NOW())
WHERE s.status = 'rejected'
  AND (
    EXISTS (SELECT 1 FROM customers c WHERE c.shop_id = s.id)
    OR EXISTS (SELECT 1 FROM vehicles v WHERE v.shop_id = s.id)
    OR EXISTS (SELECT 1 FROM repair_estimates re WHERE re.shop_id = s.id)
    OR EXISTS (SELECT 1 FROM job_orders jo WHERE jo.shop_id = s.id)
    OR EXISTS (SELECT 1 FROM invoices i WHERE i.shop_id = s.id)
    OR EXISTS (SELECT 1 FROM inventory_items ii WHERE ii.shop_id = s.id)
  );

-- Shops restored to active should have usable owner accounts again.
UPDATE profiles p
SET is_active = true
FROM shops s
WHERE p.shop_id = s.id
  AND s.status = 'active'
  AND p.is_super_admin = false
  AND p.is_active = false;


-- ----------------------------------------------------------------------------- 
-- 018_shop_plan.sql
-- ----------------------------------------------------------------------------- 

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

