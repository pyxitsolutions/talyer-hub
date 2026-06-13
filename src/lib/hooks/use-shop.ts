"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Shop } from "@/types/database";

interface ShopData {
  shopId: string | null;
  shop: Shop | null;
  profile: Profile | null;
}

async function fetchShopData(): Promise<ShopData> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { shopId: null, shop: null, profile: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { shopId: null, shop: null, profile: null };
  }

  if (!profile.shop_id) {
    return { shopId: null, shop: null, profile };
  }

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("*")
    .eq("id", profile.shop_id)
    .single();

  if (shopError || !shop) {
    return { shopId: null, shop: null, profile };
  }

  return { shopId: profile.shop_id, shop, profile };
}

export function useShop() {
  const query = useQuery({
    queryKey: ["shop"],
    queryFn: fetchShopData,
    staleTime: 5 * 60 * 1000,
  });

  return {
    shopId: query.data?.shopId ?? null,
    shop: query.data?.shop ?? null,
    profile: query.data?.profile ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
