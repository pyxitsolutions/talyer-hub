import { createClient } from "@/lib/supabase/server";

export async function resolveShopId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("shop_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.shop_id) {
    return null;
  }

  return profile.shop_id;
}

export async function getShopId(): Promise<string> {
  const shopId = await resolveShopId();
  if (!shopId) {
    throw new Error("Shop not found");
  }
  return shopId;
}
