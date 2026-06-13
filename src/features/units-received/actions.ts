"use server";

import { revalidatePath } from "next/cache";

import { getShopId } from "@/lib/auth";
import { UNIT_CATEGORIES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { Customer, UnitCategory, UnitReceived, Vehicle } from "@/types/database";
import {
  unitReceivedFormSchema,
  type UnitReceivedFormValues,
} from "./schemas";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface UnitReceivedWithRelations extends UnitReceived {
  customers?: Customer | null;
  vehicles?: Vehicle | null;
}

export interface UnitsChartDataPoint {
  label: string;
  total: number;
  pms: number;
  minor_repair: number;
  general_repair: number;
  body_repair_paint: number;
}

export interface UnitsAnalytics {
  daily: UnitsChartDataPoint[];
  monthly: UnitsChartDataPoint[];
  yearly: UnitsChartDataPoint[];
  categoryBreakdown: { name: string; value: number }[];
}

function getDateRange(period: "daily" | "monthly" | "yearly"): {
  start: string;
  end: string;
  groupBy: "day" | "month" | "year";
} {
  const now = new Date();
  const end = now.toISOString().split("T")[0];

  if (period === "daily") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { start: start.toISOString().split("T")[0], end, groupBy: "day" };
  }

  if (period === "monthly") {
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return { start: start.toISOString().split("T")[0], end, groupBy: "month" };
  }

  const start = new Date(now.getFullYear() - 4, 0, 1);
  return { start: start.toISOString().split("T")[0], end, groupBy: "year" };
}

function aggregateUnitsByPeriod(
  records: { received_date: string; category: UnitCategory }[],
  groupBy: "day" | "month" | "year"
): UnitsChartDataPoint[] {
  const buckets = new Map<string, UnitsChartDataPoint>();

  for (const record of records) {
    const date = new Date(record.received_date);
    let key: string;
    let label: string;

    if (groupBy === "day") {
      key = record.received_date;
      label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } else if (groupBy === "month") {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      label = date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    } else {
      key = String(date.getFullYear());
      label = String(date.getFullYear());
    }

    const bucket = buckets.get(key) ?? {
      label,
      total: 0,
      pms: 0,
      minor_repair: 0,
      general_repair: 0,
      body_repair_paint: 0,
    };

    bucket.total += 1;
    bucket[record.category] += 1;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);
}

export async function getUnitsReceived(
  search?: string
): Promise<ActionResult<UnitReceivedWithRelations[]>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    let query = supabase
      .from("units_received")
      .select("*, customers(full_name, customer_number), vehicles(plate_number, brand, model)")
      .eq("shop_id", shopId)
      .order("received_date", { ascending: false });

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`notes.ilike.${term},category.ilike.${term}`);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as UnitReceivedWithRelations[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch units received",
    };
  }
}

export async function getUnitsAnalytics(): Promise<ActionResult<UnitsAnalytics>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const yearlyRange = getDateRange("yearly");
    const { data, error } = await supabase
      .from("units_received")
      .select("received_date, category")
      .eq("shop_id", shopId)
      .gte("received_date", yearlyRange.start)
      .lte("received_date", yearlyRange.end);

    if (error) {
      return { success: false, error: error.message };
    }

    const records = data ?? [];
    const dailyRange = getDateRange("daily");
    const monthlyRange = getDateRange("monthly");

    const dailyRecords = records.filter(
      (r) => r.received_date >= dailyRange.start && r.received_date <= dailyRange.end
    );
    const monthlyRecords = records.filter(
      (r) => r.received_date >= monthlyRange.start && r.received_date <= monthlyRange.end
    );

    const categoryCounts = new Map<UnitCategory, number>();
    for (const row of records) {
      const cat = row.category as UnitCategory;
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    }

    return {
      success: true,
      data: {
        daily: aggregateUnitsByPeriod(dailyRecords, "day"),
        monthly: aggregateUnitsByPeriod(monthlyRecords, "month"),
        yearly: aggregateUnitsByPeriod(records, "year"),
        categoryBreakdown: UNIT_CATEGORIES.map(({ value, label }) => ({
          name: label,
          value: categoryCounts.get(value) ?? 0,
        })).filter((item) => item.value > 0),
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch analytics",
    };
  }
}

export async function createUnitReceived(
  values: UnitReceivedFormValues
): Promise<ActionResult<UnitReceived>> {
  try {
    const parsed = unitReceivedFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("units_received")
      .insert({
        shop_id: shopId,
        received_date: parsed.data.received_date,
        category: parsed.data.category,
        customer_id: parsed.data.customer_id || null,
        vehicle_id: parsed.data.vehicle_id || null,
        job_order_id: parsed.data.job_order_id || null,
        notes: parsed.data.notes || null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/units-received");
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create unit received",
    };
  }
}

export async function updateUnitReceived(
  id: string,
  values: UnitReceivedFormValues
): Promise<ActionResult<UnitReceived>> {
  try {
    const parsed = unitReceivedFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("units_received")
      .update({
        received_date: parsed.data.received_date,
        category: parsed.data.category,
        customer_id: parsed.data.customer_id || null,
        vehicle_id: parsed.data.vehicle_id || null,
        job_order_id: parsed.data.job_order_id || null,
        notes: parsed.data.notes || null,
      })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/units-received");
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update unit received",
    };
  }
}

export async function deleteUnitReceived(id: string): Promise<ActionResult> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { error } = await supabase
      .from("units_received")
      .delete()
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/units-received");
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete unit received",
    };
  }
}
