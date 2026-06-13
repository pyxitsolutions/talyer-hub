"use server";

import { revalidatePath } from "next/cache";

import { getShopId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { InventoryItem, InventoryTransaction } from "@/types/database";
import {
  inventoryFormSchema,
  stockAdjustmentSchema,
  stockTransactionSchema,
  type InventoryFormValues,
  type StockAdjustmentValues,
  type StockTransactionValues,
} from "./schemas";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface InventoryTransactionWithItem extends InventoryTransaction {
  inventory_items: InventoryItem;
}

async function getCurrentUserId(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getInventoryItems(
  search?: string
): Promise<ActionResult<InventoryItem[]>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    let query = supabase
      .from("inventory_items")
      .select("*")
      .eq("shop_id", shopId)
      .order("part_name");

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(
        `part_number.ilike.${term},part_name.ilike.${term},category.ilike.${term},supplier.ilike.${term}`
      );
    }

    const { data, error } = await query;

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

export async function getInventoryItem(
  id: string
): Promise<ActionResult<InventoryItem>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("id", id)
      .eq("shop_id", shopId)
      .single();

    if (error || !data) {
      return { success: false, error: "Inventory item not found" };
    }

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch inventory item",
    };
  }
}

export async function createInventoryItem(
  values: InventoryFormValues
): Promise<ActionResult<InventoryItem>> {
  try {
    const parsed = inventoryFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("inventory_items")
      .insert({
        shop_id: shopId,
        part_number: parsed.data.part_number,
        part_name: parsed.data.part_name,
        category: parsed.data.category || null,
        quantity: parsed.data.quantity,
        cost_price: parsed.data.cost_price,
        selling_price: parsed.data.selling_price,
        reorder_level: parsed.data.reorder_level,
        supplier: parsed.data.supplier || null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (parsed.data.quantity > 0) {
      const userId = await getCurrentUserId(supabase);
      await supabase.from("inventory_transactions").insert({
        shop_id: shopId,
        inventory_item_id: data.id,
        transaction_type: "stock_in",
        quantity: parsed.data.quantity,
        reference_type: "initial",
        notes: "Initial stock",
        created_by: userId,
      });
    }

    revalidatePath("/dashboard/inventory");
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create inventory item",
    };
  }
}

export async function updateInventoryItem(
  id: string,
  values: InventoryFormValues
): Promise<ActionResult<InventoryItem>> {
  try {
    const parsed = inventoryFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("inventory_items")
      .update({
        part_number: parsed.data.part_number,
        part_name: parsed.data.part_name,
        category: parsed.data.category || null,
        cost_price: parsed.data.cost_price,
        selling_price: parsed.data.selling_price,
        reorder_level: parsed.data.reorder_level,
        supplier: parsed.data.supplier || null,
      })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/inventory");
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update inventory item",
    };
  }
}

export async function deleteInventoryItem(id: string): Promise<ActionResult> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { error } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/inventory");
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete inventory item",
    };
  }
}

export async function stockIn(
  id: string,
  values: StockTransactionValues
): Promise<ActionResult<InventoryItem>> {
  try {
    const parsed = stockTransactionSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getShopId();
    const supabase = await createClient();
    const userId = await getCurrentUserId(supabase);

    const { data: item, error: fetchError } = await supabase
      .from("inventory_items")
      .select("quantity")
      .eq("id", id)
      .eq("shop_id", shopId)
      .single();

    if (fetchError || !item) {
      return { success: false, error: "Inventory item not found" };
    }

    const newQuantity = item.quantity + parsed.data.quantity;

    const { data, error } = await supabase
      .from("inventory_items")
      .update({ quantity: newQuantity })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const { error: transactionError } = await supabase
      .from("inventory_transactions")
      .insert({
        shop_id: shopId,
        inventory_item_id: id,
        transaction_type: "stock_in",
        quantity: parsed.data.quantity,
        reference_type: "manual",
        notes: parsed.data.notes || "Stock in",
        created_by: userId,
      });

    if (transactionError) {
      return { success: false, error: transactionError.message };
    }

    revalidatePath("/dashboard/inventory");
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to stock in",
    };
  }
}

export async function stockOut(
  id: string,
  values: StockTransactionValues
): Promise<ActionResult<InventoryItem>> {
  try {
    const parsed = stockTransactionSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getShopId();
    const supabase = await createClient();
    const userId = await getCurrentUserId(supabase);

    const { data: item, error: fetchError } = await supabase
      .from("inventory_items")
      .select("quantity, part_name")
      .eq("id", id)
      .eq("shop_id", shopId)
      .single();

    if (fetchError || !item) {
      return { success: false, error: "Inventory item not found" };
    }

    if (item.quantity < parsed.data.quantity) {
      return {
        success: false,
        error: `Insufficient stock for ${item.part_name}. Available: ${item.quantity}`,
      };
    }

    const newQuantity = item.quantity - parsed.data.quantity;

    const { data, error } = await supabase
      .from("inventory_items")
      .update({ quantity: newQuantity })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const { error: transactionError } = await supabase
      .from("inventory_transactions")
      .insert({
        shop_id: shopId,
        inventory_item_id: id,
        transaction_type: "stock_out",
        quantity: parsed.data.quantity,
        reference_type: "manual",
        notes: parsed.data.notes || "Stock out",
        created_by: userId,
      });

    if (transactionError) {
      return { success: false, error: transactionError.message };
    }

    revalidatePath("/dashboard/inventory");
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to stock out",
    };
  }
}

export async function adjustStock(
  id: string,
  values: StockAdjustmentValues
): Promise<ActionResult<InventoryItem>> {
  try {
    const parsed = stockAdjustmentSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getShopId();
    const supabase = await createClient();
    const userId = await getCurrentUserId(supabase);

    const { data: item, error: fetchError } = await supabase
      .from("inventory_items")
      .select("quantity")
      .eq("id", id)
      .eq("shop_id", shopId)
      .single();

    if (fetchError || !item) {
      return { success: false, error: "Inventory item not found" };
    }

    const adjustmentQty = parsed.data.new_quantity - item.quantity;

    const { data, error } = await supabase
      .from("inventory_items")
      .update({ quantity: parsed.data.new_quantity })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (adjustmentQty !== 0) {
      const { error: transactionError } = await supabase
        .from("inventory_transactions")
        .insert({
          shop_id: shopId,
          inventory_item_id: id,
          transaction_type: "adjustment",
          quantity: Math.abs(adjustmentQty),
          reference_type: "manual",
          notes:
            parsed.data.notes ||
            `Adjusted from ${item.quantity} to ${parsed.data.new_quantity}`,
          created_by: userId,
        });

      if (transactionError) {
        return { success: false, error: transactionError.message };
      }
    }

    revalidatePath("/dashboard/inventory");
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to adjust stock",
    };
  }
}

export async function getLowStock(): Promise<ActionResult<InventoryItem[]>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("shop_id", shopId)
      .order("quantity");

    if (error) {
      return { success: false, error: error.message };
    }

    const lowStock = (data ?? []).filter(
      (item) => item.quantity <= item.reorder_level
    );

    return { success: true, data: lowStock };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch low stock items",
    };
  }
}

export async function getHistory(
  inventoryItemId?: string
): Promise<ActionResult<InventoryTransactionWithItem[]>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    let query = supabase
      .from("inventory_transactions")
      .select("*, inventory_items(*)")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });

    if (inventoryItemId) {
      query = query.eq("inventory_item_id", inventoryItemId);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data ?? []) as InventoryTransactionWithItem[],
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch history",
    };
  }
}
