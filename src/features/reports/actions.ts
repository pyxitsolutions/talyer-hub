"use server";

import { getShopId } from "@/lib/auth";
import { EXPENSE_CATEGORIES, UNIT_CATEGORIES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseCategory, SaleType, UnitCategory } from "@/types/database";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type ReportType = "sales" | "expenses" | "units" | "pnl";

export interface ReportFilters {
  startDate: string;
  endDate: string;
  reportType: ReportType;
}

export interface SalesReportRow {
  date: string;
  type: string;
  description: string;
  amount: number;
}

export interface ExpenseReportRow {
  date: string;
  category: string;
  description: string;
  amount: number;
}

export interface UnitsReportRow {
  date: string;
  category: string;
  customer: string;
  vehicle: string;
  notes: string;
}

export interface PnLReportRow {
  period: string;
  sales: number;
  expenses: number;
  profit: number;
}

export interface ReportData {
  title: string;
  rows: Record<string, string | number>[];
  summary: Record<string, string | number>;
}

const SALE_TYPE_LABELS: Record<SaleType, string> = {
  parts: "Parts",
  materials: "Materials",
  labor: "Labor",
};

export async function generateReport(
  filters: ReportFilters
): Promise<ActionResult<ReportData>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();
    const { startDate, endDate, reportType } = filters;

    switch (reportType) {
      case "sales": {
        const { data, error } = await supabase
          .from("sales_records")
          .select("sale_date, sale_type, description, amount")
          .eq("shop_id", shopId)
          .gte("sale_date", startDate)
          .lte("sale_date", endDate)
          .order("sale_date", { ascending: false });

        if (error) return { success: false, error: error.message };

        const rows = (data ?? []).map((row) => ({
          Date: row.sale_date,
          Type: SALE_TYPE_LABELS[row.sale_type as SaleType] ?? row.sale_type,
          Description: row.description ?? "—",
          Amount: row.amount,
        }));

        const total = (data ?? []).reduce((sum, r) => sum + r.amount, 0);
        const parts = (data ?? [])
          .filter((r) => r.sale_type === "parts")
          .reduce((sum, r) => sum + r.amount, 0);
        const materials = (data ?? [])
          .filter((r) => r.sale_type === "materials")
          .reduce((sum, r) => sum + r.amount, 0);
        const labor = (data ?? [])
          .filter((r) => r.sale_type === "labor")
          .reduce((sum, r) => sum + r.amount, 0);

        return {
          success: true,
          data: {
            title: "Sales Report",
            rows,
            summary: { "Total Sales": total, Parts: parts, Materials: materials, Labor: labor },
          },
        };
      }

      case "expenses": {
        const { data, error } = await supabase
          .from("expenses")
          .select("expense_date, category, description, amount")
          .eq("shop_id", shopId)
          .gte("expense_date", startDate)
          .lte("expense_date", endDate)
          .order("expense_date", { ascending: false });

        if (error) return { success: false, error: error.message };

        const categoryLabel = (cat: string) =>
          EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;

        const rows = (data ?? []).map((row) => ({
          Date: row.expense_date,
          Category: categoryLabel(row.category),
          Description: row.description,
          Amount: row.amount,
        }));

        const total = (data ?? []).reduce((sum, r) => sum + r.amount, 0);

        return {
          success: true,
          data: {
            title: "Expenses Report",
            rows,
            summary: { "Total Expenses": total, "Record Count": rows.length },
          },
        };
      }

      case "units": {
        const { data, error } = await supabase
          .from("units_received")
          .select(
            "received_date, category, notes, customers(full_name), vehicles(plate_number, brand, model)"
          )
          .eq("shop_id", shopId)
          .gte("received_date", startDate)
          .lte("received_date", endDate)
          .order("received_date", { ascending: false });

        if (error) return { success: false, error: error.message };

        const categoryLabel = (cat: string) =>
          UNIT_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;

        const rows = (data ?? []).map((row) => {
          const customer = row.customers as unknown as { full_name: string } | null;
          const vehicle = row.vehicles as unknown as {
            plate_number: string;
            brand: string;
            model: string;
          } | null;

          return {
            Date: row.received_date,
            Category: categoryLabel(row.category),
            Customer: customer?.full_name ?? "—",
            Vehicle: vehicle
              ? `${vehicle.brand} ${vehicle.model} (${vehicle.plate_number})`
              : "—",
            Notes: row.notes ?? "—",
          };
        });

        const categoryCounts = new Map<UnitCategory, number>();
        for (const row of data ?? []) {
          const cat = row.category as UnitCategory;
          categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
        }

        const summary: Record<string, string | number> = {
          "Total Units": rows.length,
        };
        for (const { value, label } of UNIT_CATEGORIES) {
          const count = categoryCounts.get(value) ?? 0;
          if (count > 0) summary[label] = count;
        }

        return {
          success: true,
          data: { title: "Units Received Report", rows, summary },
        };
      }

      case "pnl": {
        const [salesResult, expensesResult] = await Promise.all([
          supabase
            .from("sales_records")
            .select("amount")
            .eq("shop_id", shopId)
            .gte("sale_date", startDate)
            .lte("sale_date", endDate),
          supabase
            .from("expenses")
            .select("amount")
            .eq("shop_id", shopId)
            .gte("expense_date", startDate)
            .lte("expense_date", endDate),
        ]);

        if (salesResult.error) {
          return { success: false, error: salesResult.error.message };
        }
        if (expensesResult.error) {
          return { success: false, error: expensesResult.error.message };
        }

        const totalSales =
          salesResult.data?.reduce((sum, r) => sum + r.amount, 0) ?? 0;
        const totalExpenses =
          expensesResult.data?.reduce((sum, r) => sum + r.amount, 0) ?? 0;
        const profit = totalSales - totalExpenses;

        return {
          success: true,
          data: {
            title: "Profit & Loss Report",
            rows: [
              {
                Period: `${startDate} to ${endDate}`,
                Sales: totalSales,
                Expenses: totalExpenses,
                Profit: profit,
              },
            ],
            summary: {
              "Total Sales": totalSales,
              "Total Expenses": totalExpenses,
              "Net Profit": profit,
              "Profit Margin %":
                totalSales > 0
                  ? Number(((profit / totalSales) * 100).toFixed(1))
                  : 0,
            },
          },
        };
      }

      default:
        return { success: false, error: "Invalid report type" };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate report",
    };
  }
}
