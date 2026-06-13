"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import { generateReport, type ReportData, type ReportType } from "../actions";
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

const REPORT_TABS: { value: ReportType; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "expenses", label: "Expenses" },
  { value: "units", label: "Units Received" },
  { value: "pnl", label: "Profit & Loss" },
];

export function ReportsView() {
  const defaults = getDefaultDateRange();
  const [activeTab, setActiveTab] = useState<ReportType>("sales");
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [shouldFetch, setShouldFetch] = useState(true);

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ["report", activeTab, startDate, endDate],
    queryFn: async () => {
      const result = await generateReport({
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
        if (
          typeof val === "number" &&
          (key.toLowerCase().includes("amount") ||
            key.toLowerCase().includes("sales") ||
            key.toLowerCase().includes("expenses") ||
            key.toLowerCase().includes("profit"))
        ) {
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
        description="Generate and export reports with date range filters."
        actions={
          report ? (
            <ReportExport report={report} filename={`${activeTab}-report-${startDate}`} />
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
        <TabsList>
          {REPORT_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {REPORT_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="space-y-6">
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
                          {typeof value === "number" && key.toLowerCase().includes("margin")
                            ? `${value}%`
                            : typeof value === "number" && value >= 100
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
                  emptyMessage="No data for the selected date range."
                />
              </>
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
