import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstimateStatus } from "@/types/database";

const ACTIVE_ESTIMATE_STATUSES: EstimateStatus[] = ["draft", "approved"];

export interface ActiveEstimateSummary {
  id: string;
  estimate_number: string;
  status: EstimateStatus;
}

export async function findActiveEstimateForVehicle(
  supabase: SupabaseClient,
  shopId: string,
  customerId: string,
  vehicleId: string,
  excludeEstimateId?: string
): Promise<ActiveEstimateSummary | null> {
  let query = supabase
    .from("repair_estimates")
    .select("id, estimate_number, status")
    .eq("shop_id", shopId)
    .eq("customer_id", customerId)
    .eq("vehicle_id", vehicleId)
    .in("status", ACTIVE_ESTIMATE_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1);

  if (excludeEstimateId) {
    query = query.neq("id", excludeEstimateId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return (row as ActiveEstimateSummary | undefined) ?? null;
}

export async function assertNoActiveEstimateForVehicle(
  supabase: SupabaseClient,
  shopId: string,
  customerId: string,
  vehicleId: string,
  excludeEstimateId?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const active = await findActiveEstimateForVehicle(
    supabase,
    shopId,
    customerId,
    vehicleId,
    excludeEstimateId
  );

  if (!active) {
    return { ok: true };
  }

  return {
    ok: false,
    error: `This vehicle already has an open estimate (${active.estimate_number}). Finish the visit and release the unit before creating another estimate.`,
  };
}

export async function markEstimateReleased(
  supabase: SupabaseClient,
  shopId: string,
  estimateId: string
) {
  const { error } = await supabase
    .from("repair_estimates")
    .update({ status: "released" })
    .eq("id", estimateId)
    .eq("shop_id", shopId)
    .in("status", ACTIVE_ESTIMATE_STATUSES);

  if (error) {
    throw new Error(error.message);
  }
}
