import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { RoleName } from "@/types/database";
import type { SessionContext } from "@/lib/auth";

function parseRoleName(value: unknown): RoleName | null {
  if (typeof value !== "string") return null;
  const allowed: RoleName[] = [
    "owner",
    "service_advisor",
    "technician",
    "cashier",
    "super_admin",
  ];
  return allowed.includes(value as RoleName) ? (value as RoleName) : null;
}

export async function getUserRoleName(
  supabase: SupabaseClient,
  userId: string,
  shopId: string | null
): Promise<RoleName> {
  if (!shopId) {
    return "owner";
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", userId)
    .eq("shop_id", shopId);

  if (error || !data?.length) {
    return "owner";
  }

  const roleNames = data
    .map((row) => {
      const roles = row.roles as { name: string } | { name: string }[] | null;
      if (Array.isArray(roles)) {
        return parseRoleName(roles[0]?.name);
      }
      return parseRoleName(roles?.name);
    })
    .filter((name): name is RoleName => !!name);

  if (roleNames.includes("owner")) {
    return "owner";
  }

  return roleNames[0] ?? "owner";
}

export async function requireOwner(): Promise<
  { ok: true; context: SessionContext } | { ok: false; error: string }
> {
  const { getSessionContext } = await import("@/lib/auth");
  const context = await getSessionContext();

  if (!context) {
    return { ok: false, error: "You must be signed in." };
  }

  if (context.isSuperAdmin) {
    return {
      ok: false,
      error: "Shop owner access is required for this action.",
    };
  }

  if (context.roleName !== "owner") {
    return {
      ok: false,
      error: "Only the shop owner can perform this action.",
    };
  }

  if (!context.shopId) {
    return { ok: false, error: "Shop not found." };
  }

  return { ok: true, context };
}

export async function isShopOwner(userId: string, shopId: string): Promise<boolean> {
  const supabase = await createClient();
  const roleName = await getUserRoleName(supabase, userId, shopId);
  return roleName === "owner";
}
