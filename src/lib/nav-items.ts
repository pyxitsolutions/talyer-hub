import { NAV_ITEMS, SUPER_ADMIN_NAV_ITEMS } from "@/lib/constants";
import { canAccessPlanRoute } from "@/lib/plans";
import { canAccessRoute } from "@/lib/rbac";
import type { RoleName, ShopPlan } from "@/types/database";

export function getVisibleNavItems(
  roleName: RoleName | string,
  isSuperAdmin: boolean,
  shopPlan: ShopPlan | null = "basic"
) {
  if (isSuperAdmin) {
    return SUPER_ADMIN_NAV_ITEMS;
  }

  return NAV_ITEMS.filter(
    (item) =>
      canAccessRoute(roleName, item.href) && canAccessPlanRoute(shopPlan, item.href)
  );
}
