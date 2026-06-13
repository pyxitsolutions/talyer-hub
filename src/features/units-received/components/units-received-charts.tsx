"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UnitsAnalytics } from "../actions";

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981"];

interface UnitsReceivedChartsProps {
  data: UnitsAnalytics;
}

export function UnitsReceivedCharts({ data }: UnitsReceivedChartsProps) {
  const chartData = data.categoryBreakdown.length
    ? data.categoryBreakdown
    : [{ name: "No data", value: 1 }];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">Daily (30 days)</TabsTrigger>
          <TabsTrigger value="monthly">Monthly (12 months)</TabsTrigger>
          <TabsTrigger value="yearly">Yearly (5 years)</TabsTrigger>
        </TabsList>

        {(["daily", "monthly", "yearly"] as const).map((period) => (
          <TabsContent key={period} value={period}>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-foreground">
                  Units Received — {period.charAt(0).toUpperCase() + period.slice(1)}
                </h3>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data[period]} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid hsl(var(--border))",
                        backgroundColor: "hsl(var(--card))",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="pms" stackId="a" fill={COLORS[0]} name="PMS" />
                    <Bar dataKey="minor_repair" stackId="a" fill={COLORS[1]} name="Minor Repair" />
                    <Bar dataKey="general_repair" stackId="a" fill={COLORS[2]} name="General Repair" />
                    <Bar dataKey="body_repair_paint" stackId="a" fill={COLORS[3]} name="Body Repair & Paint" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">Category Breakdown</h3>
          <p className="text-sm text-muted-foreground">Distribution by repair type</p>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) =>
                  `${name} (${(percent * 100).toFixed(0)}%)`
                }
                labelLine={false}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [value, "Units"]}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  backgroundColor: "hsl(var(--card))",
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
