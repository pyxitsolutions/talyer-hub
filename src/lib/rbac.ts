import type { RoleName } from "@/types/database";
import { ROLE_PERMISSIONS } from "./constants";

export function hasPermission(role: RoleName | string, resource: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  if (permissions.includes("*")) return true;
  return permissions.includes(resource);
}

export function canAccessRoute(role: RoleName | string, path: string): boolean {
  const routeMap: Record<string, string> = {
    "/dashboard": "dashboard",
    "/dashboard/customers": "customers",
    "/dashboard/vehicles": "vehicles",
    "/dashboard/estimates": "estimates",
    "/dashboard/job-orders": "job_orders",
    "/dashboard/invoices": "invoices",
    "/dashboard/inventory": "inventory",
    "/dashboard/units-received": "units_received",
    "/dashboard/sales": "sales",
    "/dashboard/expenses": "expenses",
    "/dashboard/service-history": "service_history",
    "/dashboard/reports": "reports",
    "/dashboard/activity-log": "activity_log",
    "/dashboard/settings": "settings",
  };

  const resource = routeMap[path];
  if (!resource) return true;
  if (resource === "dashboard" || resource === "settings") return true;
  return hasPermission(role, resource);
}
