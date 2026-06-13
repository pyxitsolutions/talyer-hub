"use server";

import { revalidatePath } from "next/cache";

import { getShopId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateNumber } from "@/lib/utils";
import type {
  Customer,
  InventoryItem,
  RepairEstimate,
  RepairEstimateItem,
  Vehicle,
} from "@/types/database";
import {
  estimateFormSchema,
  type EstimateFormValues,
  type EstimateItemValues,
} from "./schemas";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface EstimateWithRelations extends RepairEstimate {
  customers: Customer;
  vehicles: Vehicle;
  repair_estimate_items: RepairEstimateItem[];
}

function calculateCosts(items: EstimateItemValues[], laborCost: number) {
  const partsCost = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );
  return {
    parts_cost: partsCost,
    labor_cost: laborCost,
    total_cost: partsCost + laborCost,
  };
}

export async function getEstimates(
  search?: string
): Promise<ActionResult<EstimateWithRelations[]>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    let query = supabase
      .from("repair_estimates")
      .select("*, customers(*), vehicles(*), repair_estimate_items(*)")
      .eq("shop_id", shopId)
      .order("estimate_date", { ascending: false });

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(
        `estimate_number.ilike.${term},technician_name.ilike.${term}`
      );
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as EstimateWithRelations[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch estimates",
    };
  }
}

export async function getEstimate(
  id: string
): Promise<ActionResult<EstimateWithRelations>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("repair_estimates")
      .select("*, customers(*), vehicles(*), repair_estimate_items(*)")
      .eq("id", id)
      .eq("shop_id", shopId)
      .single();

    if (error || !data) {
      return { success: false, error: "Estimate not found" };
    }

    return { success: true, data: data as EstimateWithRelations };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch estimate",
    };
  }
}

export async function getCustomersForSelect(): Promise<
  ActionResult<Pick<Customer, "id" | "full_name" | "customer_number">[]>
> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("customers")
      .select("id, full_name, customer_number")
      .eq("shop_id", shopId)
      .order("full_name");

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch customers",
    };
  }
}

export async function getVehiclesByCustomer(
  customerId: string
): Promise<ActionResult<Vehicle[]>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("customer_id", customerId)
      .eq("shop_id", shopId)
      .order("plate_number");

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch vehicles",
    };
  }
}

export async function getInventoryForSelect(): Promise<
  ActionResult<
    Pick<
      InventoryItem,
      "id" | "part_name" | "part_number" | "quantity" | "selling_price"
    >[]
  >
> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("inventory_items")
      .select("id, part_name, part_number, quantity, selling_price")
      .eq("shop_id", shopId)
      .order("part_name");

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch inventory",
    };
  }
}

async function insertEstimateItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  estimateId: string,
  items: EstimateItemValues[]
) {
  if (items.length === 0) return;

  const { error } = await supabase.from("repair_estimate_items").insert(
    items.map((item) => ({
      shop_id: shopId,
      estimate_id: estimateId,
      part_name: item.part_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
      inventory_item_id: item.inventory_item_id || null,
    }))
  );

  if (error) throw new Error(error.message);
}

export async function createEstimate(
  values: EstimateFormValues
): Promise<ActionResult<RepairEstimate>> {
  try {
    const parsed = estimateFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getShopId();
    const supabase = await createClient();
    const costs = calculateCosts(parsed.data.items, parsed.data.labor_cost);

    const { count, error: countError } = await supabase
      .from("repair_estimates")
      .select("*", { count: "exact", head: true })
      .eq("shop_id", shopId);

    if (countError) {
      return { success: false, error: countError.message };
    }

    const estimateNumber = generateNumber("EST", count ?? 0);

    const { data, error } = await supabase
      .from("repair_estimates")
      .insert({
        shop_id: shopId,
        estimate_number: estimateNumber,
        estimate_date: parsed.data.estimate_date,
        customer_id: parsed.data.customer_id,
        vehicle_id: parsed.data.vehicle_id,
        chassis_number: parsed.data.chassis_number || null,
        engine_number: parsed.data.engine_number || null,
        problem_description: parsed.data.problem_description || null,
        repair_description: parsed.data.repair_description || null,
        recommendation: parsed.data.recommendation || null,
        technician_name: parsed.data.technician_name || null,
        labor_cost: costs.labor_cost,
        parts_cost: costs.parts_cost,
        total_cost: costs.total_cost,
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await insertEstimateItems(supabase, shopId, data.id, parsed.data.items);

    revalidatePath("/dashboard/estimates");
    revalidatePath("/dashboard");
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create estimate",
    };
  }
}

export async function updateEstimate(
  id: string,
  values: EstimateFormValues
): Promise<ActionResult<RepairEstimate>> {
  try {
    const parsed = estimateFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getShopId();
    const supabase = await createClient();

    const { data: existing, error: existingError } = await supabase
      .from("repair_estimates")
      .select("status")
      .eq("id", id)
      .eq("shop_id", shopId)
      .single();

    if (existingError || !existing) {
      return { success: false, error: "Estimate not found" };
    }

    if (existing.status !== "draft") {
      return {
        success: false,
        error: "Only draft estimates can be edited",
      };
    }

    const costs = calculateCosts(parsed.data.items, parsed.data.labor_cost);

    const { data, error } = await supabase
      .from("repair_estimates")
      .update({
        estimate_date: parsed.data.estimate_date,
        customer_id: parsed.data.customer_id,
        vehicle_id: parsed.data.vehicle_id,
        chassis_number: parsed.data.chassis_number || null,
        engine_number: parsed.data.engine_number || null,
        problem_description: parsed.data.problem_description || null,
        repair_description: parsed.data.repair_description || null,
        recommendation: parsed.data.recommendation || null,
        technician_name: parsed.data.technician_name || null,
        labor_cost: costs.labor_cost,
        parts_cost: costs.parts_cost,
        total_cost: costs.total_cost,
      })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const { error: deleteError } = await supabase
      .from("repair_estimate_items")
      .delete()
      .eq("estimate_id", id)
      .eq("shop_id", shopId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    await insertEstimateItems(supabase, shopId, id, parsed.data.items);

    revalidatePath("/dashboard/estimates");
    revalidatePath(`/dashboard/estimates/${id}`);
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update estimate",
    };
  }
}

export async function deleteEstimate(id: string): Promise<ActionResult> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data: existing, error: existingError } = await supabase
      .from("repair_estimates")
      .select("status")
      .eq("id", id)
      .eq("shop_id", shopId)
      .single();

    if (existingError || !existing) {
      return { success: false, error: "Estimate not found" };
    }

    if (existing.status !== "draft") {
      return {
        success: false,
        error: "Only draft estimates can be deleted",
      };
    }

    const { error } = await supabase
      .from("repair_estimates")
      .delete()
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/estimates");
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete estimate",
    };
  }
}

export async function approveEstimate(
  id: string
): Promise<ActionResult<RepairEstimate>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("repair_estimates")
      .update({ status: "approved" })
      .eq("id", id)
      .eq("shop_id", shopId)
      .eq("status", "draft")
      .select()
      .single();

    if (error || !data) {
      return {
        success: false,
        error: "Estimate not found or cannot be approved",
      };
    }

    revalidatePath("/dashboard/estimates");
    revalidatePath(`/dashboard/estimates/${id}`);
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to approve estimate",
    };
  }
}

export async function rejectEstimate(
  id: string
): Promise<ActionResult<RepairEstimate>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("repair_estimates")
      .update({ status: "rejected" })
      .eq("id", id)
      .eq("shop_id", shopId)
      .eq("status", "draft")
      .select()
      .single();

    if (error || !data) {
      return {
        success: false,
        error: "Estimate not found or cannot be rejected",
      };
    }

    revalidatePath("/dashboard/estimates");
    revalidatePath(`/dashboard/estimates/${id}`);
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to reject estimate",
    };
  }
}
