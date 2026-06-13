import type { ComponentType } from "react";
import {
  AlertTriangle,
  ClipboardList,
  DollarSign,
  FileText,
  Package,
  Receipt,
  TrendingDown,
  TrendingUp,
  Truck,
  Wrench,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { DashboardStats } from "@/types/database";
import { cn } from "@/lib/utils";

interface KpiCardsProps {
  stats: DashboardStats;
}

interface KpiCardConfig {
  title: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
}

function KpiCard({ title, value, icon: Icon, iconClassName }: KpiCardConfig) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            iconClassName
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function KpiCards({ stats }: KpiCardsProps) {
  const cards: KpiCardConfig[] = [
    {
      title: "Units Received Today",
      value: stats.dailyUnitsReceived.toString(),
      icon: Truck,
      iconClassName: "bg-blue-500/10 text-blue-600",
    },
    {
      title: "Units Received (Month)",
      value: stats.monthlyUnitsReceived.toString(),
      icon: ClipboardList,
      iconClassName: "bg-indigo-500/10 text-indigo-600",
    },
    {
      title: "Active Repairs",
      value: stats.activeRepairs.toString(),
      icon: Wrench,
      iconClassName: "bg-amber-500/10 text-amber-600",
    },
    {
      title: "Pending Estimates",
      value: stats.pendingEstimates.toString(),
      icon: FileText,
      iconClassName: "bg-violet-500/10 text-violet-600",
    },
    {
      title: "Pending Invoices",
      value: stats.pendingInvoices.toString(),
      icon: Receipt,
      iconClassName: "bg-orange-500/10 text-orange-600",
    },
    {
      title: "Low Stock Items",
      value: stats.lowStockItems.toString(),
      icon: Package,
      iconClassName: "bg-red-500/10 text-red-600",
    },
    {
      title: "Daily Sales",
      value: formatCurrency(stats.dailySales),
      icon: DollarSign,
      iconClassName: "bg-emerald-500/10 text-emerald-600",
    },
    {
      title: "Monthly Sales",
      value: formatCurrency(stats.monthlySales),
      icon: TrendingUp,
      iconClassName: "bg-green-500/10 text-green-600",
    },
    {
      title: "Monthly Expenses",
      value: formatCurrency(stats.monthlyExpenses),
      icon: TrendingDown,
      iconClassName: "bg-rose-500/10 text-rose-600",
    },
    {
      title: "Net Profit",
      value: formatCurrency(stats.netProfit),
      icon: stats.netProfit >= 0 ? TrendingUp : AlertTriangle,
      iconClassName:
        stats.netProfit >= 0
          ? "bg-teal-500/10 text-teal-600"
          : "bg-red-500/10 text-red-600",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <KpiCard key={card.title} {...card} />
      ))}
    </div>
  );
}
