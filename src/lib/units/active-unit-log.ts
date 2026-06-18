import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildLastClosedAtByVehicle,
  getUnitLogCutoffDate,
  isUnitLogEligibleForJobOrder,
} from "@/lib/units/job-order-eligibility";

const UNRELEASED_JOB_ORDER_STATUSES = ["pending", "ongoing", "completed"] as const;

export async function assertCanLogUnitForVehicle(
  supabase: SupabaseClient,
  shopId: string,
  vehicleId: string,
  excludeUnitId?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!vehicleId) {
    return { ok: true };
  }

  const { data: activeJobOrder, error: jobOrderError } = await supabase
    .from("job_orders")
    .select("job_order_number, status")
    .eq("shop_id", shopId)
    .eq("vehicle_id", vehicleId)
    .in("status", [...UNRELEASED_JOB_ORDER_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (jobOrderError) {
    return { ok: false, error: jobOrderError.message };
  }

  if (activeJobOrder) {
    const statusLabel =
      activeJobOrder.status.charAt(0).toUpperCase() +
      activeJobOrder.status.slice(1);

    return {
      ok: false,
      error: `Cannot log unit: this vehicle has an active job order (${activeJobOrder.job_order_number}, ${statusLabel}). Release the unit first before logging a new visit.`,
    };
  }

  let openUnitQuery = supabase
    .from("units_received")
    .select("id, received_date, created_at, job_order_id, vehicle_id")
    .eq("shop_id", shopId)
    .eq("vehicle_id", vehicleId)
    .is("job_order_id", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (excludeUnitId) {
    openUnitQuery = openUnitQuery.neq("id", excludeUnitId);
  }

  const { data: openUnit, error: openUnitError } = await openUnitQuery.maybeSingle();

  if (openUnitError) {
    return { ok: false, error: openUnitError.message };
  }

  if (!openUnit) {
    return { ok: true };
  }

  const { data: closedJobs, error: closedJobsError } = await supabase
    .from("job_orders")
    .select("vehicle_id, updated_at")
    .eq("shop_id", shopId)
    .eq("vehicle_id", vehicleId)
    .in("status", ["completed", "released"])
    .order("updated_at", { ascending: false });

  if (closedJobsError) {
    return { ok: false, error: closedJobsError.message };
  }

  const lastClosedAtByVehicle = buildLastClosedAtByVehicle(closedJobs ?? []);
  const cutoffDate = getUnitLogCutoffDate();
  const isCurrentOpenLog = isUnitLogEligibleForJobOrder(
    openUnit,
    lastClosedAtByVehicle,
    cutoffDate
  );

  if (isCurrentOpenLog) {
    return {
      ok: false,
      error:
        "Cannot log unit: this vehicle already has an open unit log for the current visit. Finish the visit and release the unit first.",
    };
  }

  return { ok: true };
}
