-- TalyerHub — FULL RESET (SQL Editor only)
--
-- Deletes ALL shops (cascade business data), profiles, and auth users.
-- Does NOT create the super admin login — run after this:
--   npm run db:fresh-start
-- or PowerShell:
--   .\scripts\fresh-start.ps1
--
-- SQL Editor cannot set auth passwords safely; use the Node script above.

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

-- Optional: delete shop logo files manually in Storage → shop-logos
