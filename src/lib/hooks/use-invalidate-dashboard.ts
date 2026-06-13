"use client";

import { useQueryClient } from "@tanstack/react-query";
import { DASHBOARD_QUERY_KEY } from "@/features/dashboard/components/dashboard-view";

export function useInvalidateDashboard() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
}
