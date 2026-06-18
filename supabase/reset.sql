-- =============================================================================
-- TalyerHub — reset.sql
-- =============================================================================
-- Run in Supabase Dashboard → SQL Editor.
--
-- • Business reset only — highlight and run BLOCK 1 only.
-- • Full wipe (shops + accounts) — highlight and run BLOCK 2 only,
--   or run this entire file (BLOCK 1 then BLOCK 2).
--
-- After FULL reset, create super admin:
--   npm run db:fresh-start   (uses .env.local + service role)
--   or run the SQL in DEPLOYMENT.md (promote super admin).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- BLOCK 1 — Business / operational data only
-- Keeps: auth users, profiles, roles, user_roles, shops
-- Clears: customers, vehicles, job orders, invoices, inventory, etc.
-- -----------------------------------------------------------------------------

BEGIN;

TRUNCATE TABLE
  public.activity_logs,
  public.sales_records,
  public.invoice_items,
  public.invoices,
  public.job_order_parts,
  public.job_orders,
  public.repair_estimate_items,
  public.repair_estimates,
  public.inventory_transactions,
  public.units_received,
  public.expenses,
  public.inventory_items,
  public.vehicles,
  public.customers
RESTART IDENTITY CASCADE;

COMMIT;

-- -----------------------------------------------------------------------------
-- BLOCK 2 — FULL RESET (DESTRUCTIVE)
-- Deletes ALL shops (cascade business data), profiles, and auth users.
-- Re-seeds system roles. Does NOT create a login — use npm run db:fresh-start.
-- -----------------------------------------------------------------------------

BEGIN;

DELETE FROM public.user_roles;
DELETE FROM public.shops;
DELETE FROM auth.users;

INSERT INTO public.roles (id, name, description) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'owner', 'Shop owner with full access'),
  ('a0000000-0000-0000-0000-000000000002', 'service_advisor', 'Service advisor managing estimates and customers'),
  ('a0000000-0000-0000-0000-000000000003', 'technician', 'Technician performing repairs'),
  ('a0000000-0000-0000-0000-000000000004', 'cashier', 'Cashier handling billing and payments'),
  ('a0000000-0000-0000-0000-000000000005', 'super_admin', 'Platform administrator with cross-shop access')
ON CONFLICT (name) DO NOTHING;

COMMIT;

-- Optional: delete shop logo files in Dashboard → Storage → shop-logos
