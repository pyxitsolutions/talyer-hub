import type { ExpenseCategory, UnitCategory } from "@/types/database";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "AutoCare Pro";

export const CURRENCY_CODE =
  process.env.NEXT_PUBLIC_CURRENCY_CODE || "PHP";
export const CURRENCY_LOCALE =
  process.env.NEXT_PUBLIC_CURRENCY_LOCALE || "en-PH";
export const CURRENCY_SYMBOL = CURRENCY_CODE === "PHP" ? "₱" : CURRENCY_CODE;

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
  { title: "Settings", href: "/dashboard/settings", icon: "Settings" },
] as const;

export const UNIT_CATEGORIES: { value: UnitCategory; label: string }[] = [
  { value: "pms", label: "PMS" },
  { value: "minor_repair", label: "Minor Repair" },
  { value: "general_repair", label: "General Repair" },
  { value: "body_repair_paint", label: "Body Repair & Paint" },
];

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
] as const;

export const JOB_ORDER_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "released", label: "Released" },
] as const;

export const PAYMENT_STATUSES = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
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
  owner: ["*"],
  service_advisor: [
    "customers", "vehicles", "estimates", "job_orders", "units_received", "service_history", "reports",
  ],
  technician: ["job_orders", "estimates", "vehicles", "service_history"],
  cashier: ["invoices", "customers", "sales", "reports"],
};
