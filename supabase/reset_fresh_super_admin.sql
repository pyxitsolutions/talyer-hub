-- TalyerHub — FULL RESET + SUPER ADMIN (SQL only)
-- Run in Supabase Dashboard → SQL Editor (postgres role).
--
-- WARNING: Deletes ALL shops, business data, login accounts, and profiles.
-- Creates platform super admin:
--   Email:    pyxitsolutions@gmail.com
--   Password: rio123456
--
-- After running: sign in at /login → Platform Admin

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Wipe tenant data and accounts
DELETE FROM public.user_roles;
DELETE FROM public.shops;
DELETE FROM auth.users;

-- 2) Restore system roles
INSERT INTO public.roles (id, name, description) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'owner', 'Shop owner with full access'),
  ('a0000000-0000-0000-0000-000000000002', 'service_advisor', 'Service advisor managing estimates and customers'),
  ('a0000000-0000-0000-0000-000000000003', 'technician', 'Technician performing repairs'),
  ('a0000000-0000-0000-0000-000000000004', 'cashier', 'Cashier handling billing and payments'),
  ('a0000000-0000-0000-0000-000000000005', 'super_admin', 'Platform administrator with cross-shop access')
ON CONFLICT (name) DO NOTHING;

-- 3) Create super admin auth user + profile
DO $$
DECLARE
  admin_id UUID := gen_random_uuid();
  admin_email TEXT := 'pyxitsolutions@gmail.com';
  admin_password TEXT := 'rio123456';
  admin_name TEXT := 'TalyerHub Admin';
BEGIN
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    admin_id,
    'authenticated',
    'authenticated',
    admin_email,
    crypt(admin_password, gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', admin_name),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    admin_id::text,
    admin_id,
    jsonb_build_object(
      'sub', admin_id::text,
      'email', admin_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  INSERT INTO public.profiles (
    id,
    shop_id,
    full_name,
    email,
    is_active,
    is_super_admin
  ) VALUES (
    admin_id,
    NULL,
    admin_name,
    admin_email,
    true,
    true
  );
END $$;

COMMIT;

-- Optional: delete uploaded logos in Dashboard → Storage → shop-logos
