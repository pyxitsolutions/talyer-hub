"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSuperAdminContext } from "@/lib/auth";
import { SHOP_STATUSES } from "@/lib/constants";
import { PLAN_PRICING } from "@/lib/plans";
import type { ReportData } from "@/features/reports/actions";
import {
  countShopsByStatus,
  filterTenantShops,
  getSuperAdminShopIds,
} from "@/lib/platform-admin/tenant-shops";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Shop, ShopPlan, ShopStatus } from "@/types/database";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface ShopAdminRecord extends Shop {
  owner?: Pick<
    Profile,
    "id" | "full_name" | "email" | "phone" | "is_active" | "created_at"
  > | null;
}

export interface AdminShopCounts {
  pending: number;
  active: number;
  disabled: number;
  rejected: number;
  all: number;
}

async function getAdminClientOrError() {
  const auth = await getSuperAdminContext();
  if (!auth.ok) {
    return { ok: false as const, error: auth.error };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false as const,
      error: "Server configuration error. Missing service role key.",
    };
  }

  return { ok: true as const, admin, context: auth.context };
}

async function attachOwners(shops: Shop[]): Promise<ShopAdminRecord[]> {
  const admin = createAdminClient();
  if (!admin || shops.length === 0) {
    return shops.map((shop) => ({ ...shop, owner: null }));
  }

  const shopIds = shops.map((shop) => shop.id);
  const { data: owners, error } = await admin
    .from("profiles")
    .select("id, shop_id, full_name, email, phone, is_active, created_at")
    .in("shop_id", shopIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const ownerByShopId = new Map<string, Profile>();
  for (const owner of owners ?? []) {
    if (owner.shop_id && !ownerByShopId.has(owner.shop_id)) {
      ownerByShopId.set(owner.shop_id, owner as Profile);
    }
  }

  return shops.map((shop) => ({
    ...shop,
    owner: ownerByShopId.get(shop.id) ?? null,
  }));
}

export async function getAdminShopCounts(): Promise<ActionResult<AdminShopCounts>> {
  try {
    const clientResult = await getAdminClientOrError();
    if (!clientResult.ok) {
      return { success: false, error: clientResult.error };
    }

    const excludedShopIds = await getSuperAdminShopIds(clientResult.admin);

    const { data, error } = await clientResult.admin
      .from("shops")
      .select("id, status");

    if (error) {
      return { success: false, error: error.message };
    }

    const tenantShops = filterTenantShops(
      (data ?? []) as { id: string; status: ShopStatus }[],
      excludedShopIds
    );

    const statusCounts = countShopsByStatus(tenantShops);

    return {
      success: true,
      data: {
        pending: statusCounts.pending,
        active: statusCounts.active,
        disabled: statusCounts.disabled,
        rejected: statusCounts.rejected,
        all: tenantShops.length,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch shop counts",
    };
  }
}

export async function getShopsForAdmin(
  status?: ShopStatus | "all"
): Promise<ActionResult<ShopAdminRecord[]>> {
  try {
    const clientResult = await getAdminClientOrError();
    if (!clientResult.ok) {
      return { success: false, error: clientResult.error };
    }

    const excludedShopIds = await getSuperAdminShopIds(clientResult.admin);

    let query = clientResult.admin
      .from("shops")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }

    const tenantShops = filterTenantShops((data ?? []) as Shop[], excludedShopIds);
    const records = await attachOwners(tenantShops);
    return { success: true, data: records };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch shops",
    };
  }
}

export async function approveShop(shopId: string): Promise<ActionResult<Shop>> {
  try {
    const clientResult = await getAdminClientOrError();
    if (!clientResult.ok) {
      return { success: false, error: clientResult.error };
    }

    const now = new Date().toISOString();
    const { data, error } = await clientResult.admin
      .from("shops")
      .update({
        status: "active",
        approved_at: now,
        approved_by: clientResult.context.userId,
      })
      .eq("id", shopId)
      .in("status", ["pending", "rejected"])
      .select("*")
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return {
        success: false,
        error: "Shop not found or is not awaiting approval.",
      };
    }

    await clientResult.admin
      .from("profiles")
      .update({ is_active: true })
      .eq("shop_id", shopId);

    revalidatePath("/dashboard/admin/shops");
    return { success: true, data: data as Shop };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to approve shop",
    };
  }
}

export async function disableShop(shopId: string): Promise<ActionResult<Shop>> {
  try {
    const clientResult = await getAdminClientOrError();
    if (!clientResult.ok) {
      return { success: false, error: clientResult.error };
    }

    const { data, error } = await clientResult.admin
      .from("shops")
      .update({ status: "disabled" })
      .eq("id", shopId)
      .eq("status", "active")
      .select("*")
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return {
        success: false,
        error: "Shop not found or is not active.",
      };
    }

    await clientResult.admin
      .from("profiles")
      .update({ is_active: false })
      .eq("shop_id", shopId);

    revalidatePath("/dashboard/admin/shops");
    return { success: true, data: data as Shop };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to disable shop",
    };
  }
}

export async function activateShop(shopId: string): Promise<ActionResult<Shop>> {
  try {
    const clientResult = await getAdminClientOrError();
    if (!clientResult.ok) {
      return { success: false, error: clientResult.error };
    }

    const { data, error } = await clientResult.admin
      .from("shops")
      .update({
        status: "active",
        approved_at: new Date().toISOString(),
        approved_by: clientResult.context.userId,
      })
      .eq("id", shopId)
      .eq("status", "disabled")
      .select("*")
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return {
        success: false,
        error: "Shop not found or is not disabled.",
      };
    }

    await clientResult.admin
      .from("profiles")
      .update({ is_active: true })
      .eq("shop_id", shopId);

    revalidatePath("/dashboard/admin/shops");
    return { success: true, data: data as Shop };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to activate shop",
    };
  }
}

const deleteRejectedShopSchema = z.object({
  shopId: z.string().uuid("Invalid shop"),
});

export async function deleteRejectedShop(shopId: string): Promise<ActionResult> {
  try {
    const parsed = deleteRejectedShopSchema.safeParse({ shopId });
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const clientResult = await getAdminClientOrError();
    if (!clientResult.ok) {
      return { success: false, error: clientResult.error };
    }

    const excludedShopIds = await getSuperAdminShopIds(clientResult.admin);
    if (excludedShopIds.has(parsed.data.shopId)) {
      return { success: false, error: "Cannot delete this shop." };
    }

    const { data: shop, error: shopError } = await clientResult.admin
      .from("shops")
      .select("id, status")
      .eq("id", parsed.data.shopId)
      .maybeSingle();

    if (shopError) {
      return { success: false, error: shopError.message };
    }

    if (!shop) {
      return { success: false, error: "Shop not found." };
    }

    if (shop.status !== "rejected") {
      return {
        success: false,
        error: "Only rejected registrations can be permanently deleted.",
      };
    }

    const { data: profiles, error: profilesError } = await clientResult.admin
      .from("profiles")
      .select("id, is_super_admin")
      .eq("shop_id", parsed.data.shopId);

    if (profilesError) {
      return { success: false, error: profilesError.message };
    }

    for (const profile of profiles ?? []) {
      if (profile.is_super_admin) {
        return {
          success: false,
          error: "Cannot delete a shop linked to a platform admin account.",
        };
      }
    }

    for (const profile of profiles ?? []) {
      const { error: deleteUserError } =
        await clientResult.admin.auth.admin.deleteUser(profile.id);

      if (deleteUserError) {
        return {
          success: false,
          error: `Failed to remove owner account: ${deleteUserError.message}`,
        };
      }
    }

    const { data: deletedShop, error: deleteShopError } = await clientResult.admin
      .from("shops")
      .delete()
      .eq("id", parsed.data.shopId)
      .eq("status", "rejected")
      .select("id")
      .maybeSingle();

    if (deleteShopError) {
      const message = deleteShopError.message;
      return {
        success: false,
        error: message.includes("violates foreign key constraint")
          ? "Cannot delete this shop because related records still exist."
          : message,
      };
    }

    if (!deletedShop) {
      return {
        success: false,
        error: "Shop not found or is not rejected.",
      };
    }

    revalidatePath("/dashboard/admin/shops");
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete rejected shop",
    };
  }
}

export async function rejectShop(shopId: string): Promise<ActionResult<Shop>> {
  try {
    const clientResult = await getAdminClientOrError();
    if (!clientResult.ok) {
      return { success: false, error: clientResult.error };
    }

    const { data, error } = await clientResult.admin
      .from("shops")
      .update({ status: "rejected" })
      .eq("id", shopId)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return {
        success: false,
        error: "Shop not found or is not pending approval.",
      };
    }

    await clientResult.admin
      .from("profiles")
      .update({ is_active: false })
      .eq("shop_id", shopId);

    revalidatePath("/dashboard/admin/shops");
    return { success: true, data: data as Shop };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to reject shop",
    };
  }
}

const resetShopOwnerPasswordSchema = z.object({
  shopId: z.string().uuid("Invalid shop"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function resetShopOwnerPassword(
  shopId: string,
  password: string
): Promise<
  ActionResult<{
    ownerEmail: string;
    ownerName: string;
  }>
> {
  try {
    const parsed = resetShopOwnerPasswordSchema.safeParse({ shopId, password });
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const clientResult = await getAdminClientOrError();
    if (!clientResult.ok) {
      return { success: false, error: clientResult.error };
    }

    const excludedShopIds = await getSuperAdminShopIds(clientResult.admin);
    if (excludedShopIds.has(parsed.data.shopId)) {
      return { success: false, error: "Cannot reset password for this shop." };
    }

    const { data: owner, error: ownerError } = await clientResult.admin
      .from("profiles")
      .select("id, full_name, email, is_super_admin")
      .eq("shop_id", parsed.data.shopId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (ownerError) {
      return { success: false, error: ownerError.message };
    }

    if (!owner) {
      return { success: false, error: "No owner account found for this shop." };
    }

    if (owner.is_super_admin) {
      return {
        success: false,
        error: "Cannot reset password for a platform admin account from here.",
      };
    }

    const { error: updateError } = await clientResult.admin.auth.admin.updateUserById(
      owner.id,
      { password: parsed.data.password }
    );

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return {
      success: true,
      data: {
        ownerEmail: owner.email,
        ownerName: owner.full_name,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to reset owner password",
    };
  }
}

const setShopPlanSchema = z.object({
  shopId: z.string().uuid("Invalid shop"),
  plan: z.enum(["basic", "pro"]),
});

export async function setShopPlan(
  shopId: string,
  plan: ShopPlan
): Promise<ActionResult<Shop>> {
  try {
    const parsed = setShopPlanSchema.safeParse({ shopId, plan });
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const clientResult = await getAdminClientOrError();
    if (!clientResult.ok) {
      return { success: false, error: clientResult.error };
    }

    const excludedShopIds = await getSuperAdminShopIds(clientResult.admin);
    if (excludedShopIds.has(parsed.data.shopId)) {
      return { success: false, error: "Cannot change plan for this shop." };
    }

    const { data, error } = await clientResult.admin
      .from("shops")
      .update({ plan: parsed.data.plan })
      .eq("id", parsed.data.shopId)
      .in("status", ["active", "disabled", "pending"])
      .select("*")
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "Shop not found or cannot change plan." };
    }

    revalidatePath("/dashboard/admin/shops");
    revalidatePath("/dashboard/admin/reports");
    return { success: true, data: data as Shop };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update shop plan",
    };
  }
}

export type PlatformReportType = "registrations" | "subscriptions";

export interface PlatformReportFilters {
  startDate: string;
  endDate: string;
  reportType: PlatformReportType;
}

export interface PlatformAdminReportSummary extends AdminShopCounts {
  basicActive: number;
  proActive: number;
  estimatedMrr: number;
}

function getStatusLabel(status: ShopStatus): string {
  return SHOP_STATUSES.find((item) => item.value === status)?.label ?? status;
}

function getPlanLabel(plan: ShopPlan): string {
  return PLAN_PRICING[plan].label;
}

export async function getPlatformAdminReportSummary(): Promise<
  ActionResult<PlatformAdminReportSummary>
> {
  try {
    const countsResult = await getAdminShopCounts();
    if (!countsResult.success) {
      return { success: false, error: countsResult.error };
    }

    const shopsResult = await getShopsForAdmin("all");
    if (!shopsResult.success) {
      return { success: false, error: shopsResult.error };
    }

    const activeShops = shopsResult.data.filter((shop) => shop.status === "active");
    const basicActive = activeShops.filter((shop) => shop.plan === "basic").length;
    const proActive = activeShops.filter((shop) => shop.plan === "pro").length;
    const estimatedMrr =
      basicActive * PLAN_PRICING.basic.price + proActive * PLAN_PRICING.pro.price;

    return {
      success: true,
      data: {
        ...countsResult.data,
        basicActive,
        proActive,
        estimatedMrr,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load platform summary",
    };
  }
}

export async function generatePlatformAdminReport(
  filters: PlatformReportFilters
): Promise<ActionResult<ReportData>> {
  try {
    const auth = await getSuperAdminContext();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }

    const shopsResult = await getShopsForAdmin("all");
    if (!shopsResult.success) {
      return { success: false, error: shopsResult.error };
    }

    const { startDate, endDate, reportType } = filters;

    if (reportType === "registrations") {
      const rows = shopsResult.data
        .filter((shop) => {
          const created = shop.created_at.slice(0, 10);
          return created >= startDate && created <= endDate;
        })
        .map((shop) => ({
          Registered: shop.created_at.slice(0, 10),
          Shop: shop.shop_name,
          Status: getStatusLabel(shop.status),
          Plan: getPlanLabel(shop.plan),
          Owner: shop.owner?.full_name ?? shop.owner_name,
          Email: shop.owner?.email ?? shop.email ?? "—",
          Approved: shop.approved_at?.slice(0, 10) ?? "—",
        }));

      const statusCounts = new Map<string, number>();
      for (const shop of shopsResult.data.filter((item) => {
        const created = item.created_at.slice(0, 10);
        return created >= startDate && created <= endDate;
      })) {
        const label = getStatusLabel(shop.status);
        statusCounts.set(label, (statusCounts.get(label) ?? 0) + 1);
      }

      const summary: Record<string, string | number> = {
        "New Registrations": rows.length,
      };
      for (const [label, count] of statusCounts) {
        summary[label] = count;
      }

      return {
        success: true,
        data: {
          title: "Shop Registrations Report",
          rows,
          summary,
        },
      };
    }

    const activeShops = shopsResult.data.filter((shop) => shop.status === "active");
    const rows = activeShops.map((shop) => ({
      Shop: shop.shop_name,
      Plan: getPlanLabel(shop.plan),
      "Monthly Fee": PLAN_PRICING[shop.plan].price,
      Owner: shop.owner?.full_name ?? shop.owner_name,
      Email: shop.owner?.email ?? shop.email ?? "—",
      Registered: shop.created_at.slice(0, 10),
    }));

    const basicActive = activeShops.filter((shop) => shop.plan === "basic").length;
    const proActive = activeShops.filter((shop) => shop.plan === "pro").length;
    const estimatedMrr =
      basicActive * PLAN_PRICING.basic.price + proActive * PLAN_PRICING.pro.price;

    return {
      success: true,
      data: {
        title: "Active Subscriptions Report",
        rows,
        summary: {
          "Active Shops": activeShops.length,
          [`${PLAN_PRICING.basic.label} Plans`]: basicActive,
          [`${PLAN_PRICING.pro.label} Plans`]: proActive,
          "Estimated MRR": estimatedMrr,
        },
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate report",
    };
  }
}
