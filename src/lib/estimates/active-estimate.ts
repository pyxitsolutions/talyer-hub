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

export interface OpenEstimateSummary {
  id: string;
  estimate_number: string;
  status: EstimateStatus;
  vehicle_id: string;
  vehicles: { plate_number: string } | null;
}

export async function findOpenEstimatesForCustomer(
  supabase: SupabaseClient,
  shopId: string,
  customerId: string
): Promise<OpenEstimateSummary[]> {
  const { data, error } = await supabase
    .from("repair_estimates")
    .select(
      "id, estimate_number, status, vehicle_id, vehicles(plate_number)"
    )
    .eq("shop_id", shopId)
    .eq("customer_id", customerId)
    .in("status", ACTIVE_ESTIMATE_STATUSES)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as OpenEstimateSummary[];
}

function formatOpenEstimatesMessage(
  openEstimates: OpenEstimateSummary[],
  subject: "customer" | "vehicle"
): string {
  const labels = openEstimates.map((estimate) => {
    const plate = estimate.vehicles?.plate_number ?? "unknown plate";
    return `${estimate.estimate_number} (${estimate.status}, ${plate})`;
  });

  const prefix =
    subject === "customer"
      ? "This customer has open estimate(s)"
      : "This vehicle has an open estimate";

  return `${prefix}: ${labels.join(", ")}. Finish the visit and release the unit before deactivating.`;
}

export async function assertCanDeactivateCustomer(
  supabase: SupabaseClient,
  shopId: string,
  customerId: string
): Promise<
  | { ok: true }
  | { ok: false; error: string; openEstimates: OpenEstimateSummary[] }
> {
  const openEstimates = await findOpenEstimatesForCustomer(
    supabase,
    shopId,
    customerId
  );

  if (openEstimates.length === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    error: formatOpenEstimatesMessage(openEstimates, "customer"),
    openEstimates,
  };
}

export async function assertCanDeactivateVehicle(
  supabase: SupabaseClient,
  shopId: string,
  customerId: string,
  vehicleId: string
): Promise<
  | { ok: true }
  | { ok: false; error: string; openEstimate: ActiveEstimateSummary | null }
> {
  const openEstimate = await findActiveEstimateForVehicle(
    supabase,
    shopId,
    customerId,
    vehicleId
  );

  if (!openEstimate) {
    return { ok: true };
  }

  return {
    ok: false,
    error: formatOpenEstimatesMessage(
      [
        {
          id: openEstimate.id,
          estimate_number: openEstimate.estimate_number,
          status: openEstimate.status,
          vehicle_id: vehicleId,
          vehicles: null,
        },
      ],
      "vehicle"
    ),
    openEstimate,
  };
}
