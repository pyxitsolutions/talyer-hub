-- Store labor from the source estimate on the job order
ALTER TABLE job_orders
  ADD COLUMN IF NOT EXISTS labor_cost DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE job_orders jo
SET labor_cost = re.labor_cost
FROM repair_estimates re
WHERE jo.estimate_id = re.id;
