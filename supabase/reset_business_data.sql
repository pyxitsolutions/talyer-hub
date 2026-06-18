-- TalyerHub — Reset business / operational data
--
-- Keeps: auth users, profiles, roles, user_roles, shops (tenant settings)
-- Clears: customers, vehicles, estimates, job orders, invoices, inventory,
--         units received, expenses, sales records
--
-- How to run:
--   Supabase Dashboard → SQL Editor → paste → Run
--
-- Optional after reset: run supabase/seed.sql for demo data

BEGIN;

TRUNCATE TABLE
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

-- Verify (optional)
-- SELECT 'customers' AS table_name, COUNT(*) FROM public.customers
-- UNION ALL SELECT 'job_orders', COUNT(*) FROM public.job_orders
-- UNION ALL SELECT 'units_received', COUNT(*) FROM public.units_received;
