import { createClient } from "@/lib/supabase/server";
import { getUserRoleName } from "@/lib/auth/roles";
import { getPostLoginPath, type RouteAccess } from "@/lib/auth/routing";
import type { Profile, RoleName, Shop, ShopStatus } from "@/types/database";

export interface SessionContext {
  userId: string;
  profile: Profile;
  shop: Shop | null;
  shopId: string | null;
  shopStatus: ShopStatus | null;
  isSuperAdmin: boolean;
  roleName: RoleName;
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profileData) {
    return null;
  }

  const profile = profileData as Profile;
  let shop: Shop | null = null;

  if (profile.shop_id) {
    const { data: shopData } = await supabase
      .from("shops")
      .select("*")
      .eq("id", profile.shop_id)
      .maybeSingle();

    shop = (shopData as Shop | null) ?? null;
  }

  return {
    userId: user.id,
    profile,
    shop,
    shopId: profile.shop_id,
    shopStatus: shop?.status ?? null,
    isSuperAdmin: profile.is_super_admin === true,
    roleName: profile.is_super_admin
      ? "super_admin"
      : await getUserRoleName(supabase, user.id, profile.shop_id),
  };
}

export async function isSuperAdmin(): Promise<boolean> {
  const context = await getSessionContext();
  return context?.isSuperAdmin === true;
}

export async function requireSuperAdmin(): Promise<SessionContext> {
  const result = await getSuperAdminContext();
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.context;
}

export async function getSuperAdminContext(): Promise<
  { ok: true; context: SessionContext } | { ok: false; error: string }
> {
  const context = await getSessionContext();
  if (!context) {
    return { ok: false, error: "You must be signed in." };
  }
  if (!context.isSuperAdmin) {
    return {
      ok: false,
      error: "Unauthorized. Super admin access required.",
    };
  }
  return { ok: true, context };
}

export async function getAuthRedirectPath(): Promise<string> {
  const context = await getSessionContext();
  if (!context) {
    return "/login";
  }

  const access: RouteAccess = {
    hasProfile: true,
    isSuperAdmin: context.isSuperAdmin,
    shopStatus: context.shopStatus,
    shopId: context.shopId,
    shopPlan: context.shop?.plan ?? "basic",
  };

  return getPostLoginPath(access);
}

export async function resolveShopId(): Promise<string | null> {
  const context = await getSessionContext();
  if (!context?.shopId) {
    return null;
  }

  if (
    !context.isSuperAdmin &&
    context.shopStatus &&
    context.shopStatus !== "active"
  ) {
    return null;
  }

  return context.shopId;
}

export async function getShopId(): Promise<string> {
  const shopId = await resolveShopId();
  if (!shopId) {
    throw new Error("Shop not found");
  }
  return shopId;
}
