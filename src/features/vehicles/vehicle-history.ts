import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface VehicleHistoryCounts {
  estimates: number;
  jobOrders: number;
  invoices: number;
  unitsReceived: number;
}

export function vehicleHasHistory(counts: VehicleHistoryCounts): boolean {
  return (
    counts.estimates > 0 ||
    counts.jobOrders > 0 ||
    counts.invoices > 0 ||
    counts.unitsReceived > 0
  );
}

export async function getVehicleHistoryCounts(
  supabase: SupabaseClient,
  shopId: string,
  vehicleId: string
): Promise<VehicleHistoryCounts> {
  const [
    estimatesResult,
    jobOrdersResult,
    invoicesResult,
    unitsReceivedResult,
  ] = await Promise.all([
    supabase
      .from("repair_estimates")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("vehicle_id", vehicleId),
    supabase
      .from("job_orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("vehicle_id", vehicleId),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("vehicle_id", vehicleId),
    supabase
      .from("units_received")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("vehicle_id", vehicleId),
  ]);

  return {
    estimates: estimatesResult.count ?? 0,
    jobOrders: jobOrdersResult.count ?? 0,
    invoices: invoicesResult.count ?? 0,
    unitsReceived: unitsReceivedResult.count ?? 0,
  };
}

export async function assertVehicleIsActive(
  supabase: SupabaseClient,
  shopId: string,
  vehicleId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("is_active, customer_id, customers(is_active)")
    .eq("id", vehicleId)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "Vehicle not found in your shop" };
  }

  const customerRaw = data.customers as unknown as
    | { is_active: boolean }
    | { is_active: boolean }[]
    | null;
  const customer = Array.isArray(customerRaw) ? customerRaw[0] : customerRaw;

  if (!customer?.is_active) {
    return {
      ok: false,
      error:
        "This vehicle belongs to an inactive customer. Reactivate the customer first.",
    };
  }

  if (!data.is_active) {
    return {
      ok: false,
      error:
        "This vehicle is inactive. Reactivate it under Vehicles or the customer profile before using it.",
    };
  }

  return { ok: true };
}
