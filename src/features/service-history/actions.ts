"use server";

import { getShopId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface ServiceHistoryRecord {
  id: string;
  repair_date: string;
  repair_type: string;
  technician: string | null;
  invoice_number: string | null;
  cost: number;
  customer_name: string;
  plate_number: string;
  chassis_number: string | null;
  vehicle_info: string;
  status: string;
  source: "job_order" | "invoice";
}

export async function searchServiceHistory(
  search?: string
): Promise<ActionResult<ServiceHistoryRecord[]>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const [jobOrdersResult, invoicesResult] = await Promise.all([
      supabase
        .from("job_orders")
        .select(
          "id, job_order_number, date_started, date_completed, assigned_technician, status, repair_description, customers(full_name), vehicles(plate_number, brand, model, chassis_number)"
        )
        .eq("shop_id", shopId)
        .order("date_started", { ascending: false }),
      supabase
        .from("invoices")
        .select(
          "id, invoice_number, invoice_date, technician_name, total_amount, repair_description, customers(full_name), vehicles(plate_number, brand, model, chassis_number)"
        )
        .eq("shop_id", shopId)
        .order("invoice_date", { ascending: false }),
    ]);

    if (jobOrdersResult.error) {
      return { success: false, error: jobOrdersResult.error.message };
    }
    if (invoicesResult.error) {
      return { success: false, error: invoicesResult.error.message };
    }

    const records: ServiceHistoryRecord[] = [];

    for (const jo of jobOrdersResult.data ?? []) {
      const customer = jo.customers as unknown as { full_name: string } | null;
      const vehicle = jo.vehicles as unknown as {
        plate_number: string;
        brand: string;
        model: string;
        chassis_number: string | null;
      } | null;

      records.push({
        id: jo.id,
        repair_date: jo.date_completed ?? jo.date_started ?? "",
        repair_type: jo.repair_description ?? "Repair",
        technician: jo.assigned_technician,
        invoice_number: null,
        cost: 0,
        customer_name: customer?.full_name ?? "Unknown",
        plate_number: vehicle?.plate_number ?? "—",
        chassis_number: vehicle?.chassis_number ?? null,
        vehicle_info: vehicle ? `${vehicle.brand} ${vehicle.model}` : "—",
        status: jo.status,
        source: "job_order",
      });
    }

    for (const inv of invoicesResult.data ?? []) {
      const customer = inv.customers as unknown as { full_name: string } | null;
      const vehicle = inv.vehicles as unknown as {
        plate_number: string;
        brand: string;
        model: string;
        chassis_number: string | null;
      } | null;

      records.push({
        id: inv.id,
        repair_date: inv.invoice_date,
        repair_type: inv.repair_description ?? "Invoice",
        technician: inv.technician_name,
        invoice_number: inv.invoice_number,
        cost: inv.total_amount,
        customer_name: customer?.full_name ?? "Unknown",
        plate_number: vehicle?.plate_number ?? "—",
        chassis_number: vehicle?.chassis_number ?? null,
        vehicle_info: vehicle ? `${vehicle.brand} ${vehicle.model}` : "—",
        status: "invoiced",
        source: "invoice",
      });
    }

    records.sort(
      (a, b) =>
        new Date(b.repair_date).getTime() - new Date(a.repair_date).getTime()
    );

    if (!search?.trim()) {
      return { success: true, data: records };
    }

    const term = search.trim().toLowerCase();
    const filtered = records.filter(
      (r) =>
        r.customer_name.toLowerCase().includes(term) ||
        r.plate_number.toLowerCase().includes(term) ||
        (r.chassis_number?.toLowerCase().includes(term) ?? false) ||
        r.invoice_number?.toLowerCase().includes(term)
    );

    return { success: true, data: filtered };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to search service history",
    };
  }
}
