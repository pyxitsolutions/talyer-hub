-- TalyerHub — Full tenant reset (DESTRUCTIVE)
--
-- Prefer: node scripts/reset-database.mjs  (deletes auth + data via API)
-- Or run: supabase/reset_all_including_accounts.sql in SQL Editor
--
-- Deletes ALL shops, business data, login accounts, and profiles.
-- Re-seeds roles only. Does NOT remove schema/migrations.
--
-- After reset:
--   1. Register again at /register
--   2. Super admin: UPDATE profiles SET is_super_admin = true WHERE email = 'you@example.com';
--   3. Optional demo data: run supabase/seed.sql

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
