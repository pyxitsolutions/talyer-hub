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
