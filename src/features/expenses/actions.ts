"use server";

import { revalidatePath } from "next/cache";

import { getProShopId } from "@/lib/auth/plan-guard";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { Expense, ExpenseCategory } from "@/types/database";
import { expenseFormSchema, type ExpenseFormValues } from "./schemas";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface ExpenseChartDataPoint {
  label: string;
  total: number;
}

export interface ExpenseAnalytics {
  daily: ExpenseChartDataPoint[];
  monthly: ExpenseChartDataPoint[];
  yearly: ExpenseChartDataPoint[];
  categoryBreakdown: { name: string; value: number }[];
}

export interface PnLSummary {
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
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

function aggregateExpensesByPeriod(
  records: { expense_date: string; amount: number }[],
  groupBy: "day" | "month" | "year"
): ExpenseChartDataPoint[] {
  const buckets = new Map<string, ExpenseChartDataPoint>();

  for (const record of records) {
    const date = new Date(record.expense_date);
    let key: string;
    let label: string;

    if (groupBy === "day") {
      key = record.expense_date;
      label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } else if (groupBy === "month") {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      label = date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    } else {
      key = String(date.getFullYear());
      label = String(date.getFullYear());
    }

    const bucket = buckets.get(key) ?? { label, total: 0 };
    bucket.total += record.amount;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);
}

function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
}

function getMonthEnd(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];
}

export async function getExpenses(
  search?: string
): Promise<ActionResult<Expense[]>> {
  try {
    const shopId = await getProShopId();
    const supabase = await createClient();

    let query = supabase
      .from("expenses")
      .select("*")
      .eq("shop_id", shopId)
      .order("expense_date", { ascending: false });

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`description.ilike.${term},category.ilike.${term}`);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch expenses",
    };
  }
}

export async function getExpenseAnalytics(): Promise<ActionResult<ExpenseAnalytics>> {
  try {
    const shopId = await getProShopId();
    const supabase = await createClient();

    const yearlyRange = getDateRange("yearly");
    const { data, error } = await supabase
      .from("expenses")
      .select("expense_date, category, amount")
      .eq("shop_id", shopId)
      .gte("expense_date", yearlyRange.start)
      .lte("expense_date", yearlyRange.end);

    if (error) {
      return { success: false, error: error.message };
    }

    const records = data ?? [];
    const dailyRange = getDateRange("daily");
    const monthlyRange = getDateRange("monthly");

    const dailyRecords = records.filter(
      (r) => r.expense_date >= dailyRange.start && r.expense_date <= dailyRange.end
    );
    const monthlyRecords = records.filter(
      (r) => r.expense_date >= monthlyRange.start && r.expense_date <= monthlyRange.end
    );

    const categoryCounts = new Map<ExpenseCategory, number>();
    for (const row of records) {
      const cat = row.category as ExpenseCategory;
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + row.amount);
    }

    return {
      success: true,
      data: {
        daily: aggregateExpensesByPeriod(dailyRecords, "day"),
        monthly: aggregateExpensesByPeriod(monthlyRecords, "month"),
        yearly: aggregateExpensesByPeriod(records, "year"),
        categoryBreakdown: EXPENSE_CATEGORIES.map(({ value, label }) => ({
          name: label,
          value: categoryCounts.get(value) ?? 0,
        })).filter((item) => item.value > 0),
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch expense analytics",
    };
  }
}

export async function getPnLSummary(): Promise<ActionResult<PnLSummary>> {
  try {
    const shopId = await getProShopId();
    const supabase = await createClient();
    const monthStart = getMonthStart();
    const monthEnd = getMonthEnd();

    const [salesResult, expensesResult] = await Promise.all([
      supabase
        .from("sales_records")
        .select("amount")
        .eq("shop_id", shopId)
        .gte("sale_date", monthStart)
        .lte("sale_date", monthEnd),
      supabase
        .from("expenses")
        .select("amount")
        .eq("shop_id", shopId)
        .gte("expense_date", monthStart)
        .lte("expense_date", monthEnd),
    ]);

    if (salesResult.error) {
      return { success: false, error: salesResult.error.message };
    }
    if (expensesResult.error) {
      return { success: false, error: expensesResult.error.message };
    }

    const totalSales =
      salesResult.data?.reduce((sum, row) => sum + row.amount, 0) ?? 0;
    const totalExpenses =
      expensesResult.data?.reduce((sum, row) => sum + row.amount, 0) ?? 0;
    const netProfit = totalSales - totalExpenses;
    const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

    return {
      success: true,
      data: { totalSales, totalExpenses, netProfit, profitMargin },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch P&L summary",
    };
  }
}

export async function createExpense(
  values: ExpenseFormValues
): Promise<ActionResult<Expense>> {
  try {
    const parsed = expenseFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getProShopId();
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        shop_id: shopId,
        expense_date: parsed.data.expense_date,
        category: parsed.data.category,
        description: parsed.data.description,
        amount: parsed.data.amount,
        created_by: user?.id ?? null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/expenses");
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create expense",
    };
  }
}

export async function updateExpense(
  id: string,
  values: ExpenseFormValues
): Promise<ActionResult<Expense>> {
  try {
    const parsed = expenseFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getProShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("expenses")
      .update({
        expense_date: parsed.data.expense_date,
        category: parsed.data.category,
        description: parsed.data.description,
        amount: parsed.data.amount,
      })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/expenses");
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update expense",
    };
  }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  try {
    const shopId = await getProShopId();
    const supabase = await createClient();

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/expenses");
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete expense",
    };
  }
}
