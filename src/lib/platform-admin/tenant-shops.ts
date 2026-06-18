import type { SupabaseClient } from "@supabase/supabase-js";

import type { Shop, ShopStatus } from "@/types/database";

export async function getSuperAdminShopIds(
  admin: SupabaseClient
): Promise<Set<string>> {
  const { data, error } = await admin
    .from("profiles")
    .select("shop_id")
    .eq("is_super_admin", true)
    .not("shop_id", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  return new Set(
    (data ?? [])
      .map((row) => row.shop_id)
      .filter((shopId): shopId is string => !!shopId)
  );
}

export function filterTenantShops<T extends { id: string }>(
  shops: T[],
  excludedShopIds: Set<string>
): T[] {
  if (excludedShopIds.size === 0) {
    return shops;
  }

  return shops.filter((shop) => !excludedShopIds.has(shop.id));
}

export function countShopsByStatus(
  shops: { status: ShopStatus }[]
): Record<ShopStatus, number> {
  const counts: Record<ShopStatus, number> = {
    pending: 0,
    active: 0,
    disabled: 0,
    rejected: 0,
  };

  for (const shop of shops) {
    counts[shop.status] += 1;
  }

  return counts;
}
