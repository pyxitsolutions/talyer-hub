"use server";

import { assertProPlan } from "@/lib/auth/plan-guard";
import { requireOwner } from "@/lib/auth/roles";
import { LIST_PAGE_SIZE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { PaginatedResult } from "@/lib/types/pagination";
import type { ActivityLog } from "@/types/database";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function getActivityLogs(
  search = "",
  actionType = "all",
  page = 1,
  pageSize = LIST_PAGE_SIZE
): Promise<ActionResult<PaginatedResult<ActivityLog>>> {
  try {
    const planError = await assertProPlan();
    if (planError) {
      return planError;
    }

    const ownerCheck = await requireOwner();
    if (!ownerCheck.ok) {
      return { success: false, error: ownerCheck.error };
    }

    const shopId = ownerCheck.context.shopId!;
    const supabase = await createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("activity_logs")
      .select("*", { count: "exact" })
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });

    if (actionType !== "all") {
      query = query.eq("action_type", actionType);
    }

    const trimmedSearch = search.trim();
    if (trimmedSearch) {
      query = query.or(
        [
          `summary.ilike.%${trimmedSearch}%`,
          `actor_name.ilike.%${trimmedSearch}%`,
          `entity_label.ilike.%${trimmedSearch}%`,
        ].join(",")
      );
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        items: (data ?? []) as ActivityLog[],
        total: count ?? 0,
        page,
        pageSize,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load activity logs",
    };
  }
}
