"use server";

import { revalidatePath } from "next/cache";

import { getProShopId } from "@/lib/auth/plan-guard";
import { createClient } from "@/lib/supabase/server";
import type { SalesRecord, SaleType } from "@/types/database";
import { salesFormSchema, type SalesFormValues } from "./schemas";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface SalesChartDataPoint {
  label: string;
  total: number;
  parts: number;
  materials: number;
  labor: number;
}

export interface SalesAnalytics {
  daily: SalesChartDataPoint[];
  monthly: SalesChartDataPoint[];
  yearly: SalesChartDataPoint[];
  breakdown: { name: string; value: number }[];
  totals: { parts: number; materials: number; labor: number; total: number };
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

function aggregateSalesByPeriod(
  records: { sale_date: string; sale_type: SaleType; amount: number }[],
  groupBy: "day" | "month" | "year"
): SalesChartDataPoint[] {
  const buckets = new Map<string, SalesChartDataPoint>();

  for (const record of records) {
    const date = new Date(record.sale_date);
    let key: string;
    let label: string;

    if (groupBy === "day") {
      key = record.sale_date;
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
      parts: 0,
      materials: 0,
      labor: 0,
    };

    bucket.total += record.amount;
    bucket[record.sale_type] += record.amount;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);
}

export async function getSalesRecords(
  search?: string
): Promise<ActionResult<SalesRecord[]>> {
  try {
    const shopId = await getProShopId();
    const supabase = await createClient();

    let query = supabase
      .from("sales_records")
      .select("*")
      .eq("shop_id", shopId)
      .order("sale_date", { ascending: false });

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`description.ilike.${term},sale_type.ilike.${term}`);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch sales records",
    };
  }
}

export async function getSalesAnalytics(): Promise<ActionResult<SalesAnalytics>> {
  try {
    const shopId = await getProShopId();
    const supabase = await createClient();

    const yearlyRange = getDateRange("yearly");
    const { data, error } = await supabase
      .from("sales_records")
      .select("sale_date, sale_type, amount")
      .eq("shop_id", shopId)
      .gte("sale_date", yearlyRange.start)
      .lte("sale_date", yearlyRange.end);

    if (error) {
      return { success: false, error: error.message };
    }

    const records = data ?? [];
    const dailyRange = getDateRange("daily");
    const monthlyRange = getDateRange("monthly");

    const dailyRecords = records.filter(
      (r) => r.sale_date >= dailyRange.start && r.sale_date <= dailyRange.end
    );
    const monthlyRecords = records.filter(
      (r) => r.sale_date >= monthlyRange.start && r.sale_date <= monthlyRange.end
    );

    const totals = { parts: 0, materials: 0, labor: 0, total: 0 };
    for (const row of records) {
      totals[row.sale_type as SaleType] += row.amount;
      totals.total += row.amount;
    }

    return {
      success: true,
      data: {
        daily: aggregateSalesByPeriod(dailyRecords, "day"),
        monthly: aggregateSalesByPeriod(monthlyRecords, "month"),
        yearly: aggregateSalesByPeriod(records, "year"),
        breakdown: [
          { name: "Parts", value: totals.parts },
          { name: "Materials", value: totals.materials },
          { name: "Labor", value: totals.labor },
        ].filter((item) => item.value > 0),
        totals,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch sales analytics",
    };
  }
}

export async function createSalesRecord(
  values: SalesFormValues
): Promise<ActionResult<SalesRecord>> {
  try {
    const parsed = salesFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getProShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("sales_records")
      .insert({
        shop_id: shopId,
        sale_date: parsed.data.sale_date,
        sale_type: parsed.data.sale_type,
        description: parsed.data.description || null,
        amount: parsed.data.amount,
        invoice_id: parsed.data.invoice_id || null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/sales");
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create sales record",
    };
  }
}

export async function updateSalesRecord(
  id: string,
  values: SalesFormValues
): Promise<ActionResult<SalesRecord>> {
  try {
    const parsed = salesFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getProShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("sales_records")
      .update({
        sale_date: parsed.data.sale_date,
        sale_type: parsed.data.sale_type,
        description: parsed.data.description || null,
        amount: parsed.data.amount,
        invoice_id: parsed.data.invoice_id || null,
      })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/sales");
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update sales record",
    };
  }
}

export async function deleteSalesRecord(id: string): Promise<ActionResult> {
  try {
    const shopId = await getProShopId();
    const supabase = await createClient();

    const { error } = await supabase
      .from("sales_records")
      .delete()
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/sales");
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete sales record",
    };
  }
}
