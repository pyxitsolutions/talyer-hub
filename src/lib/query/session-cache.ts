import type { QueryClient } from "@tanstack/react-query";

export function clearSessionQueryCache(queryClient: QueryClient) {
  queryClient.clear();
}

export function resetTenantQueryCache(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: ["shop"] });
  queryClient.removeQueries({ queryKey: ["dashboard"] });
  queryClient.removeQueries({ queryKey: ["customers"] });
  queryClient.removeQueries({ queryKey: ["vehicles"] });
  queryClient.removeQueries({ queryKey: ["invoices"] });
  queryClient.removeQueries({ queryKey: ["job-orders"] });
  queryClient.removeQueries({ queryKey: ["estimates"] });
  queryClient.removeQueries({ queryKey: ["inventory"] });
  queryClient.removeQueries({ queryKey: ["sales"] });
  queryClient.removeQueries({ queryKey: ["expenses"] });
  queryClient.removeQueries({ queryKey: ["units-received"] });
  queryClient.removeQueries({ queryKey: ["shop-settings"] });
}
