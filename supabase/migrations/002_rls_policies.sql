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
