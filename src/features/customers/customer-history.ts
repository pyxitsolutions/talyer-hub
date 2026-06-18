import type { createClient } from "@/lib/supabase/server";
import {
  getVehicleHistoryCounts,
  vehicleHasHistory,
} from "@/features/vehicles/vehicle-history";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface CustomerHistoryCounts {
  estimates: number;
  jobOrders: number;
  invoices: number;
  unitsReceived: number;
  vehiclesWithHistory: number;
}

export function customerHasHistory(counts: CustomerHistoryCounts): boolean {
  return (
    counts.estimates > 0 ||
    counts.jobOrders > 0 ||
    counts.invoices > 0 ||
    counts.unitsReceived > 0 ||
    counts.vehiclesWithHistory > 0
  );
}

export async function getCustomerHistoryCounts(
  supabase: SupabaseClient,
  shopId: string,
  customerId: string
): Promise<CustomerHistoryCounts> {
  const [
    estimatesResult,
    jobOrdersResult,
    invoicesResult,
    unitsReceivedResult,
    vehiclesResult,
  ] = await Promise.all([
    supabase
      .from("repair_estimates")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("customer_id", customerId),
    supabase
      .from("job_orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("customer_id", customerId),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("customer_id", customerId),
    supabase
      .from("units_received")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("customer_id", customerId),
    supabase
      .from("vehicles")
      .select("id")
      .eq("shop_id", shopId)
      .eq("customer_id", customerId),
  ]);

  let vehiclesWithHistory = 0;
  for (const vehicle of vehiclesResult.data ?? []) {
    const vehicleCounts = await getVehicleHistoryCounts(
      supabase,
      shopId,
      vehicle.id
    );
    if (vehicleHasHistory(vehicleCounts)) {
      vehiclesWithHistory += 1;
    }
  }

  return {
    estimates: estimatesResult.count ?? 0,
    jobOrders: jobOrdersResult.count ?? 0,
    invoices: invoicesResult.count ?? 0,
    unitsReceived: unitsReceivedResult.count ?? 0,
    vehiclesWithHistory,
  };
}

export async function assertCustomerIsActive(
  supabase: SupabaseClient,
  shopId: string,
  customerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("customers")
    .select("is_active")
    .eq("id", customerId)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "Customer not found in your shop" };
  }

  if (!data.is_active) {
    return {
      ok: false,
      error:
        "This customer is inactive. Reactivate them under Customers before using them in new records.",
    };
  }

  return { ok: true };
}
