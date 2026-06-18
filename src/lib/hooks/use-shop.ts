"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Shop } from "@/types/database";

export const SHOP_QUERY_KEY = "shop" as const;

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
    .maybeSingle();

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
    .maybeSingle();

  if (shopError || !shop) {
    return { shopId: null, shop: null, profile };
  }

  return { shopId: profile.shop_id, shop, profile };
}

export function useShop() {
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (active) {
        setUserId(user?.id ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  const query = useQuery({
    queryKey: [SHOP_QUERY_KEY, userId],
    queryFn: fetchShopData,
    enabled: !!userId,
    staleTime: 60 * 1000,
    refetchOnMount: "always",
  });

  return {
    shopId: query.data?.shopId ?? null,
    shop: query.data?.shop ?? null,
    profile: query.data?.profile ?? null,
    loading: !userId || query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
