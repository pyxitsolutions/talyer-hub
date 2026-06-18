import type { SupabaseClient } from "@supabase/supabase-js";

import { getSessionContext } from "@/lib/auth";
import type { RoleName } from "@/types/database";

export type ActivityActionType =
  | "unit_received"
  | "estimate_created"
  | "estimate_approved"
  | "job_order_released"
  | "invoice_created"
  | "invoice_paid";

export interface LogActivityInput {
  shopId: string;
  userId: string;
  actorName: string;
  actorRole?: RoleName | string | null;
  actionType: ActivityActionType;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
}

export async function getActivityActor() {
  const context = await getSessionContext();
  if (!context?.shopId) {
    return null;
  }

  return {
    shopId: context.shopId,
    userId: context.userId,
    actorName: context.profile.full_name,
    actorRole: context.roleName,
  };
}

export async function logActivity(
  supabase: SupabaseClient,
  input: LogActivityInput
): Promise<void> {
  try {
    const { error } = await supabase.from("activity_logs").insert({
      shop_id: input.shopId,
      user_id: input.userId,
      actor_name: input.actorName,
      actor_role: input.actorRole ?? null,
      action_type: input.actionType,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      entity_label: input.entityLabel ?? null,
      summary: input.summary,
      metadata: input.metadata ?? null,
    });

    if (error) {
      console.error("Failed to write activity log:", error.message);
    }
  } catch (err) {
    console.error(
      "Failed to write activity log:",
      err instanceof Error ? err.message : err
    );
  }
}
