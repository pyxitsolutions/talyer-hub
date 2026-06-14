-- PyX AutoCare Pro — Full tenant reset (DESTRUCTIVE)
--
-- Deletes ALL shops and shop-linked data (CASCADE).
-- Keeps: auth.users, profiles (shop_id cleared), roles table
-- Clears: user_roles, all business data, shop settings
--
-- After this:
--   1. Users can register again at /register, OR
--   2. Manually link profile to a new shop, OR
--   3. Run seed.sql then link your auth user to the demo shop
--
-- How to run:
--   Supabase Dashboard → SQL Editor → paste → Run
--
-- WARNING: This does NOT delete auth.users accounts.
-- To remove login accounts: Supabase → Authentication → Users (manual).

BEGIN;

-- Detach profiles before shop delete (shop_id is ON DELETE SET NULL anyway)
UPDATE public.profiles
SET shop_id = NULL,
    updated_at = NOW()
WHERE shop_id IS NOT NULL;

DELETE FROM public.shops;

COMMIT;

-- Optional: reload demo roles + sample shop data
-- Run supabase/seed.sql in a separate SQL Editor tab after this script.

-- Optional: clear uploaded shop logos from Storage
-- Supabase → Storage → shop-logos → delete files manually,
-- or use the Storage API / dashboard.
