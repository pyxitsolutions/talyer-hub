"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportExport } from "@/features/reports/components/report-export";
import { ReportFilters } from "@/features/reports/components/report-filters";
import { formatCurrency } from "@/lib/utils";
import type { ReportData } from "@/features/reports/actions";
import {
  generatePlatformAdminReport,
  getPlatformAdminReportSummary,
  type PlatformReportType,
} from "../actions";

function getDefaultDateRange() {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  return { start, end };
}

const REPORT_TABS: { value: PlatformReportType; label: string }[] = [
  { value: "registrations", label: "Shop Registrations" },
  { value: "subscriptions", label: "Active Subscriptions" },
];

function isCurrencySummaryKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.includes("mrr") ||
    lower.includes("fee") ||
    lower.includes("revenue") ||
    lower.includes("billed") ||
    lower.includes("collected")
  );
}

function isCurrencyColumnKey(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.includes("fee") || lower.includes("amount") || lower.includes("mrr");
}

export function PlatformReportsView() {
  const defaults = getDefaultDateRange();
  const [activeTab, setActiveTab] = useState<PlatformReportType>("registrations");
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [shouldFetch, setShouldFetch] = useState(true);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["platform-admin-report-summary"],
    queryFn: async () => {
      const result = await getPlatformAdminReportSummary();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ["platform-admin-report", activeTab, startDate, endDate],
    queryFn: async () => {
      const result = await generatePlatformAdminReport({
        startDate,
        endDate,
        reportType: activeTab,
      });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: shouldFetch,
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
        title="Platform Reports"
        description="Overview and exportable reports across all registered shops."
        actions={
          report ? (
            <ReportExport
              report={report}
              filename={`platform-${activeTab}-${startDate}`}
              allowExcelExport
            />
          ) : undefined
        }
      />

      {summaryLoading ? (
        <LoadingSpinner />
      ) : summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Total Shops" value={String(summary.all)} />
          <SummaryCard label="Pending Approval" value={String(summary.pending)} />
          <SummaryCard label="Active Shops" value={String(summary.active)} />
          <SummaryCard
            label="Estimated MRR"
            value={formatCurrency(summary.estimatedMrr)}
          />
          <SummaryCard label="Basic (Active)" value={String(summary.basicActive)} />
          <SummaryCard label="Pro (Active)" value={String(summary.proActive)} />
          <SummaryCard label="Deactivated" value={String(summary.disabled)} />
          <SummaryCard label="Rejected" value={String(summary.rejected)} />
        </div>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value as PlatformReportType);
          setShouldFetch(true);
        }}
      >
        <TabsList>
          {REPORT_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {REPORT_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="space-y-6">
            {tab.value === "registrations" ? (
              <ReportFilters
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onGenerate={handleGenerate}
                isLoading={isLoading}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Snapshot of all active shops and their current subscription plans.
              </p>
            )}

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
                          {typeof value === "number" && isCurrencySummaryKey(key)
                            ? formatCurrency(value)
                            : String(value)}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <DataTable
                  columns={columns}
                  data={report.rows as ReportData["rows"]}
                  emptyMessage={
                    tab.value === "registrations"
                      ? "No shop registrations in the selected date range."
                      : "No active shops yet."
                  }
                />
              </>
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
