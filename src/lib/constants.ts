import type { ExpenseCategory, UnitCategory } from "@/types/database";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "TalyerHub";
export const APP_LOGO_PATH = "/talyerhub-logo-ph.png";
export const APP_DESCRIPTION =
  "Auto care shop management system for talyers";
export const LEGAL_ENTITY_NAME =
  process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME || "PyX IT Solutions";
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "pyxitsolutions@gmail.com";
export const DATA_RETENTION_YEARS = 3;

export const CURRENCY_CODE =
  process.env.NEXT_PUBLIC_CURRENCY_CODE || "PHP";
export const CURRENCY_LOCALE =
  process.env.NEXT_PUBLIC_CURRENCY_LOCALE || "en-PH";
export const CURRENCY_SYMBOL = CURRENCY_CODE === "PHP" ? "₱" : CURRENCY_CODE;

export const SUPER_ADMIN_NAV_ITEMS = [
  { title: "Shop Management", href: "/dashboard/admin/shops", icon: "Shield" },
  { title: "Reports", href: "/dashboard/admin/reports", icon: "BarChart3" },
] as const;

export const SHOP_STATUSES = [
  { value: "pending", label: "Pending Approval" },
  { value: "active", label: "Active" },
  { value: "disabled", label: "Deactivated" },
  { value: "rejected", label: "Rejected" },
] as const;

export const NAV_ITEMS = [
  { title: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { title: "Customers", href: "/dashboard/customers", icon: "Users" },
  { title: "Vehicles", href: "/dashboard/vehicles", icon: "Car" },
  { title: "Estimates", href: "/dashboard/estimates", icon: "FileText" },
  { title: "Job Orders", href: "/dashboard/job-orders", icon: "Wrench" },
  { title: "Invoices", href: "/dashboard/invoices", icon: "Receipt" },
  { title: "Inventory", href: "/dashboard/inventory", icon: "Package" },
  { title: "Units Received", href: "/dashboard/units-received", icon: "Truck" },
  { title: "Sales", href: "/dashboard/sales", icon: "TrendingUp" },
  { title: "Expenses", href: "/dashboard/expenses", icon: "Wallet" },
  { title: "Service History", href: "/dashboard/service-history", icon: "History" },
  { title: "Reports", href: "/dashboard/reports", icon: "BarChart3" },
  { title: "Activity Log", href: "/dashboard/activity-log", icon: "ScrollText" },
  { title: "Settings", href: "/dashboard/settings", icon: "Settings" },
] as const;

export const UNIT_CATEGORIES: { value: UnitCategory; label: string }[] = [
  { value: "pms", label: "PMS" },
  { value: "minor_repair", label: "Minor Repair" },
  { value: "general_repair", label: "General Repair" },
  { value: "body_repair_paint", label: "Body Repair & Paint" },
];

/** Unit logs older than this cannot be linked to a new job order. */
export const UNIT_LOG_JOB_ORDER_MAX_AGE_DAYS = 30;

/** Default page size for list tables (job orders, invoices, estimates). */
export const LIST_PAGE_SIZE = 50;

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "shop_expenses", label: "Shop Expenses" },
  { value: "food", label: "Food" },
  { value: "kitchen_supplies", label: "Kitchen Supplies" },
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "internet", label: "Internet" },
  { value: "rent", label: "Rent" },
  { value: "salary_expenses", label: "Salary Expenses" },
  { value: "weekly_salary", label: "Weekly Salary" },
  { value: "monthly_salary", label: "Monthly Salary" },
  { value: "yearly_salary", label: "Yearly Salary" },
];

export const ESTIMATE_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "released", label: "Released" },
] as const;

export const JOB_ORDER_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "released", label: "Released" },
] as const;

export const PAYMENT_STATUSES = [
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
] as const;

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "check", label: "Check" },
  { value: "other", label: "Other" },
] as const;

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ["platform_admin"],
  owner: ["*"],
  service_advisor: [
    "customers", "vehicles", "estimates", "job_orders", "units_received", "service_history", "reports",
  ],
  technician: ["job_orders", "estimates", "vehicles", "service_history"],
  cashier: ["invoices", "customers", "sales", "reports"],
};

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  service_advisor: "Service Advisor",
  technician: "Technician",
  cashier: "Cashier",
  super_admin: "Super Admin",
};

export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  unit_received: "Unit Received",
  estimate_created: "Estimate Created",
  estimate_approved: "Estimate Approved",
  job_order_released: "Job Order Released",
  invoice_created: "Invoice Created",
  invoice_paid: "Invoice Paid",
};
