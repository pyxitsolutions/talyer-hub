import { getSessionContext, resolveShopId } from "@/lib/auth";
import { shopHasProAccess } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { UNIT_CATEGORIES } from "@/lib/constants";
import type { DashboardStats, UnitCategory } from "@/types/database";

export interface TrendDataPoint {
  month: string;
  value: number;
}

export interface CategoryDataPoint {
  name: string;
  value: number;
}

export interface TopPartDataPoint {
  name: string;
  quantity: number;
  revenue: number;
}

export interface DashboardData {
  stats: DashboardStats;
  revenueTrend: TrendDataPoint[];
  expenseTrend: TrendDataPoint[];
  profitTrend: TrendDataPoint[];
  repairCategories: CategoryDataPoint[];
  topSellingParts: TopPartDataPoint[];
}

export type DashboardActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
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

function getLastSixMonths(): { key: string; label: string; start: string; end: string }[] {
  const months: { key: string; label: string; start: string; end: string }[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(date.getFullYear(), date.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];
    const label = date.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });

    months.push({ key: `${date.getFullYear()}-${date.getMonth()}`, label, start, end });
  }

  return months;
}

async function getDashboardStats(shopId: string): Promise<DashboardStats> {
  const supabase = await createClient();
  const today = getTodayDate();
  const monthStart = getMonthStart();
  const monthEnd = getMonthEnd();

  const [
    dailyUnitsResult,
    monthlyUnitsResult,
    activeRepairsResult,
    pendingEstimatesResult,
    pendingInvoicesResult,
    lowStockResult,
    dailySalesResult,
    monthlySalesResult,
    monthlyExpensesResult,
  ] = await Promise.all([
    supabase
      .from("units_received")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("received_date", today),
    supabase
      .from("units_received")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .gte("received_date", monthStart)
      .lte("received_date", monthEnd),
    supabase
      .from("job_orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("status", "ongoing"),
    supabase
      .from("repair_estimates")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("status", "draft"),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .neq("payment_status", "paid"),
    supabase
      .from("inventory_items")
      .select("quantity, reorder_level")
      .eq("shop_id", shopId),
    supabase
      .from("sales_records")
      .select("amount")
      .eq("shop_id", shopId)
      .eq("sale_date", today),
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

  const lowStockItems =
    lowStockResult.data?.filter(
      (item) => item.quantity <= item.reorder_level
    ).length ?? 0;
  let dailySales =
    dailySalesResult.data?.reduce((sum, row) => sum + Number(row.amount), 0) ?? 0;
  let monthlySales =
    monthlySalesResult.data?.reduce((sum, row) => sum + Number(row.amount), 0) ?? 0;

  if (monthlySales === 0) {
    const { data: paidInvoices } = await supabase
      .from("invoices")
      .select("amount_paid, invoice_date")
      .eq("shop_id", shopId)
      .gt("amount_paid", 0)
      .gte("invoice_date", monthStart)
      .lte("invoice_date", monthEnd);

    monthlySales =
      paidInvoices?.reduce((sum, row) => sum + Number(row.amount_paid), 0) ?? 0;
  }

  if (dailySales === 0) {
    const { data: todayPaid } = await supabase
      .from("invoices")
      .select("amount_paid")
      .eq("shop_id", shopId)
      .gt("amount_paid", 0)
      .eq("invoice_date", today);

    dailySales =
      todayPaid?.reduce((sum, row) => sum + Number(row.amount_paid), 0) ?? 0;
  }

  const monthlyExpenses =
    monthlyExpensesResult.data?.reduce((sum, row) => sum + Number(row.amount), 0) ?? 0;

  return {
    dailyUnitsReceived: dailyUnitsResult.count ?? 0,
    monthlyUnitsReceived: monthlyUnitsResult.count ?? 0,
    activeRepairs: activeRepairsResult.count ?? 0,
    pendingEstimates: pendingEstimatesResult.count ?? 0,
    pendingInvoices: pendingInvoicesResult.count ?? 0,
    lowStockItems,
    dailySales,
    monthlySales,
    monthlyExpenses,
    netProfit: monthlySales - monthlyExpenses,
  };
}

async function getRevenueTrend(shopId: string): Promise<TrendDataPoint[]> {
  const supabase = await createClient();
  const months = getLastSixMonths();

  const results = await Promise.all(
    months.map((month) =>
      supabase
        .from("sales_records")
        .select("amount")
        .eq("shop_id", shopId)
        .gte("sale_date", month.start)
        .lte("sale_date", month.end)
    )
  );

  return months.map((month, index) => ({
    month: month.label,
    value:
      results[index].data?.reduce((sum, row) => sum + row.amount, 0) ?? 0,
  }));
}

async function getExpenseTrend(shopId: string): Promise<TrendDataPoint[]> {
  const supabase = await createClient();
  const months = getLastSixMonths();

  const results = await Promise.all(
    months.map((month) =>
      supabase
        .from("expenses")
        .select("amount")
        .eq("shop_id", shopId)
        .gte("expense_date", month.start)
        .lte("expense_date", month.end)
    )
  );

  return months.map((month, index) => ({
    month: month.label,
    value:
      results[index].data?.reduce((sum, row) => sum + row.amount, 0) ?? 0,
  }));
}

async function getProfitTrend(
  revenueTrend: TrendDataPoint[],
  expenseTrend: TrendDataPoint[]
): Promise<TrendDataPoint[]> {
  return revenueTrend.map((point, index) => ({
    month: point.month,
    value: point.value - (expenseTrend[index]?.value ?? 0),
  }));
}

async function getRepairCategories(shopId: string): Promise<CategoryDataPoint[]> {
  const supabase = await createClient();
  const monthStart = getMonthStart();
  const monthEnd = getMonthEnd();

  const { data } = await supabase
    .from("units_received")
    .select("category")
    .eq("shop_id", shopId)
    .gte("received_date", monthStart)
    .lte("received_date", monthEnd);

  const counts = new Map<UnitCategory, number>();

  for (const row of data ?? []) {
    const category = row.category as UnitCategory;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return UNIT_CATEGORIES.map(({ value, label }) => ({
    name: label,
    value: counts.get(value) ?? 0,
  })).filter((item) => item.value > 0);
}

async function getTopSellingParts(shopId: string): Promise<TopPartDataPoint[]> {
  const supabase = await createClient();
  const monthStart = getMonthStart();
  const monthEnd = getMonthEnd();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id")
    .eq("shop_id", shopId)
    .gte("invoice_date", monthStart)
    .lte("invoice_date", monthEnd);

  if (!invoices?.length) {
    return [];
  }

  const invoiceIds = invoices.map((inv) => inv.id);

  const { data: items } = await supabase
    .from("invoice_items")
    .select("part_name, quantity, total_price")
    .eq("shop_id", shopId)
    .in("invoice_id", invoiceIds);

  const partMap = new Map<string, { quantity: number; revenue: number }>();

  for (const item of items ?? []) {
    const existing = partMap.get(item.part_name) ?? { quantity: 0, revenue: 0 };
    partMap.set(item.part_name, {
      quantity: existing.quantity + item.quantity,
      revenue: existing.revenue + item.total_price,
    });
  }

  return Array.from(partMap.entries())
    .map(([name, stats]) => ({
      name,
      quantity: stats.quantity,
      revenue: stats.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

export async function loadDashboardData(): Promise<
  DashboardActionResult<DashboardData>
> {
  try {
    const context = await getSessionContext();
    const shopId = await resolveShopId();
    if (!shopId || !context) {
      return { success: false, error: "Shop is not active yet." };
    }

    const [
      stats,
      revenueTrend,
      expenseTrend,
      repairCategories,
      topSellingParts,
    ] = await Promise.all([
      getDashboardStats(shopId),
      getRevenueTrend(shopId),
      getExpenseTrend(shopId),
      getRepairCategories(shopId),
      getTopSellingParts(shopId),
    ]);

    const profitTrend = await getProfitTrend(revenueTrend, expenseTrend);
    const isPro = shopHasProAccess(context.shop?.plan);

    return {
      success: true,
      data: {
        stats,
        revenueTrend: isPro ? revenueTrend : [],
        expenseTrend: isPro ? expenseTrend : [],
        profitTrend: isPro ? profitTrend : [],
        repairCategories: isPro ? repairCategories : [],
        topSellingParts: isPro ? topSellingParts : [],
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load dashboard",
    };
  }
}
