"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Lock } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BASIC_REPORT_TYPES,
  PLAN_PRICING,
  canAccessReportType,
  shopHasProAccess,
  type ReportType,
} from "@/lib/plans";
import { useShop } from "@/lib/hooks/use-shop";
import { formatCurrency } from "@/lib/utils";
import { generateReport, type ReportData } from "../actions";
import { formatReportSummaryValue, isCurrencyColumnKey } from "../format";
import { ReportExport } from "./report-export";
import { ReportFilters } from "./report-filters";

function getDefaultDateRange() {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  return { start, end };
}

const REPORT_TABS: { value: ReportType; label: string; proOnly: boolean }[] = [
  { value: "units", label: "Units Received", proOnly: false },
  { value: "invoices", label: "Invoices", proOnly: false },
  { value: "job_orders", label: "Job Orders", proOnly: false },
  { value: "sales", label: "Sales", proOnly: true },
  { value: "expenses", label: "Expenses", proOnly: true },
  { value: "pnl", label: "Profit & Loss", proOnly: true },
];

function getDefaultTab(): ReportType {
  return BASIC_REPORT_TYPES[0];
}

export function ReportsView() {
  const { shop, loading: shopLoading } = useShop();
  const plan = shop?.plan ?? "basic";
  const isPro = shopHasProAccess(plan);
  const defaults = getDefaultDateRange();
  const [activeTab, setActiveTab] = useState<ReportType>(() => getDefaultTab());
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [shouldFetch, setShouldFetch] = useState(true);

  const canViewActiveTab = canAccessReportType(plan, activeTab);

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ["report", activeTab, startDate, endDate, plan],
    queryFn: async () => {
      const result = await generateReport({
        startDate,
        endDate,
        reportType: activeTab,
      });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: shouldFetch && !shopLoading && canViewActiveTab,
  });

  const handleGenerate = () => {
    setShouldFetch(true);
    refetch();
  };

  const columns = useMemo<ColumnDef<Record<string, string | number>>[]>(() => {
    if (!report?.rows.length) return [];
    const keys = Object.keys(report.rows[0]);
    return keys.map((key) => ({
      accessorKey: key,
      header: key,
      cell: ({ row }) => {
        const val = row.original[key];
        if (typeof val === "number" && isCurrencyColumnKey(key)) {
          return formatCurrency(val);
        }
        return String(val);
      },
    }));
  }, [report]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={
          isPro
            ? "Generate and export operational and financial reports with date range filters."
            : "Basic reports for your daily workflow. Upgrade to Pro for sales, expenses, P&L, and Excel export."
        }
        actions={
          report && canViewActiveTab ? (
            <ReportExport
              report={report}
              filename={`${activeTab}-report-${startDate}`}
              allowExcelExport={isPro}
            />
          ) : undefined
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as ReportType);
          setShouldFetch(true);
        }}
      >
        <TabsList className="h-auto flex-wrap justify-start">
          {REPORT_TABS.map((tab) => {
            const locked = tab.proOnly && !isPro;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                {locked ? <Lock className="h-3.5 w-3.5 opacity-60" /> : null}
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {REPORT_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="space-y-6">
            {tab.proOnly && !isPro ? (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-base">Pro report</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    {tab.label} reports are included in Pro (₱{PLAN_PRICING.pro.price}
                    /month) along with sales & expenses tracking and Excel export.
                  </p>
                  <Button asChild size="sm">
                    <Link href="/dashboard/upgrade">View plans & upgrade</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <ReportFilters
                  startDate={startDate}
                  endDate={endDate}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  onGenerate={handleGenerate}
                  isLoading={isLoading}
                />

                {isLoading ? (
                  <LoadingSpinner />
                ) : report ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {Object.entries(report.summary).map(([key, value]) => (
                        <Card key={key}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                              {key}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xl font-semibold">
                              {formatReportSummaryValue(key, value)}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <DataTable
                      columns={columns}
                      data={report.rows as ReportData["rows"]}
                      emptyMessage="No data for the selected date range."
                    />
                  </>
                ) : null}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
