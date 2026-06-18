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
