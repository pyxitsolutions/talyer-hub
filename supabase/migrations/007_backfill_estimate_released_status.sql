-- Backfill: estimates linked to released job orders
UPDATE repair_estimates re
SET status = 'released'
FROM job_orders jo
WHERE jo.estimate_id = re.id
  AND jo.status = 'released'
  AND re.status IN ('draft', 'approved');
