"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";
import { useShop } from "@/lib/hooks/use-shop";
import { getDashboardData } from "@/features/dashboard/actions";
import { CategoryChart } from "./category-chart";
import { ExpenseChart } from "./expense-chart";
import { KpiCards } from "./kpi-cards";
import { ProfitChart } from "./profit-chart";
import { RevenueChart } from "./revenue-chart";
import { TopPartsChart } from "./top-parts-chart";

export const DASHBOARD_QUERY_KEY = ["dashboard"] as const;

export function DashboardView() {
  const { profile, shopId, loading: shopLoading } = useShop();
  const userName = profile?.full_name ?? null;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: async () => {
      const result = await getDashboardData();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: !!shopId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back${userName ? `, ${userName}` : ""}. Here's an overview of ${APP_NAME}.`}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </PageHeader>

      {shopLoading || isLoading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load dashboard"}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : data ? (
        <>
          <KpiCards stats={data.stats} />

          <div className="grid gap-4 lg:grid-cols-2">
            <RevenueChart data={data.revenueTrend} />
            <ExpenseChart data={data.expenseTrend} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ProfitChart data={data.profitTrend} />
            <CategoryChart data={data.repairCategories} />
          </div>

          <TopPartsChart data={data.topSellingParts} />
        </>
      ) : null}
    </div>
  );
}
