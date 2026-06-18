import { getSessionContext, type SessionContext } from "@/lib/auth";
import { getUpgradeMessage, shopHasProAccess } from "@/lib/plans";

export type PlanGuardResult =
  | { ok: true; context: SessionContext }
  | { ok: false; error: string };

export async function requireProPlan(): Promise<PlanGuardResult> {
  const context = await getSessionContext();
  if (!context) {
    return { ok: false, error: "You must be signed in." };
  }
  if (context.isSuperAdmin) {
    return { ok: true, context };
  }
  if (!shopHasProAccess(context.shop?.plan)) {
    return { ok: false, error: getUpgradeMessage() };
  }
  return { ok: true, context };
}

export async function getProShopId(): Promise<string> {
  const result = await requireProPlan();
  if (!result.ok) {
    throw new Error(result.error);
  }
  if (!result.context.shopId) {
    throw new Error("Shop not found");
  }
  return result.context.shopId;
}

export async function assertProPlan(): Promise<{ success: false; error: string } | null> {
  const result = await requireProPlan();
  if (!result.ok) {
    return { success: false, error: result.error };
  }
  return null;
}
