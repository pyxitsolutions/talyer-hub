"use server";

import {
  loadDashboardData,
  type DashboardActionResult,
  type DashboardData,
} from "./queries";

export type {
  CategoryDataPoint,
  DashboardActionResult,
  DashboardData,
  TopPartDataPoint,
  TrendDataPoint,
} from "./queries";

export async function getDashboardData(): Promise<
  DashboardActionResult<DashboardData>
> {
  return loadDashboardData();
}
