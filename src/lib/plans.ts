import { APP_NAME } from "@/lib/constants";
import type { ShopPlan } from "@/types/database";

export const PLAN_PRICING = {
  basic: { label: "Basic", price: 349, currency: "PHP" },
  pro: { label: "Pro", price: 649, currency: "PHP" },
} as const;

export const PRO_PLAN_ROUTES = [
  "/dashboard/inventory",
  "/dashboard/sales",
  "/dashboard/expenses",
  "/dashboard/service-history",
  "/dashboard/activity-log",
] as const;

export const BASIC_REPORT_TYPES = [
  "units",
  "invoices",
  "job_orders",
] as const;

export const PRO_REPORT_TYPES = ["sales", "expenses", "pnl"] as const;

export type BasicReportType = (typeof BASIC_REPORT_TYPES)[number];
export type ProReportType = (typeof PRO_REPORT_TYPES)[number];
export type ReportType = BasicReportType | ProReportType;

export const BASIC_PLAN_FEATURES = [
  "15-day trial available — contact support",
  "Dashboard with key KPIs",
  "Customers & vehicles",
  "Units received (visit logging)",
  "Repair estimates with PDF",
  "Job orders",
  "Invoices & payments",
  "Basic reports (PDF export)",
  "Shop settings",
  "Owner account only",
] as const;

export const PRO_PLAN_FEATURES = [
  "Everything in Basic",
  "Inventory & stock tracking",
  "Sales & expenses",
  "Advanced reports (sales, expenses, P&L & Excel)",
  "Service history",
  "Activity log",
  "Multi-role team (advisor, technician, cashier)",
  "Advanced dashboard charts",
  "Up to 10 team members",
] as const;

export function isProRoute(pathname: string): boolean {
  return PRO_PLAN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function shopHasProAccess(plan: ShopPlan | null | undefined): boolean {
  return plan === "pro";
}

export function canAccessPlanRoute(
  plan: ShopPlan | null | undefined,
  href: string
): boolean {
  if (!isProRoute(href)) {
    return true;
  }
  return shopHasProAccess(plan);
}

export function getPlanLabel(plan: ShopPlan | null | undefined): string {
  if (plan === "pro") {
    return PLAN_PRICING.pro.label;
  }
  return PLAN_PRICING.basic.label;
}

export function getUpgradeMessage(): string {
  return `This feature is included in ${PLAN_PRICING.pro.label} (₱${PLAN_PRICING.pro.price}/month). Contact ${APP_NAME} support to upgrade.`;
}

export function isProReportType(reportType: ReportType): boolean {
  return (PRO_REPORT_TYPES as readonly string[]).includes(reportType);
}

export function canAccessReportType(
  plan: ShopPlan | null | undefined,
  reportType: ReportType
): boolean {
  if (isProReportType(reportType)) {
    return shopHasProAccess(plan);
  }
  return true;
}
