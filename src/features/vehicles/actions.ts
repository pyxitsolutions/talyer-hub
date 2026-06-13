"use server";

import { revalidatePath } from "next/cache";

import { getShopId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Customer, Vehicle } from "@/types/database";
import { vehicleFormSchema, type VehicleFormValues } from "./schemas";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface VehicleWithCustomer extends Vehicle {
  customers: Customer;
}

export async function getVehicles(
  search?: string
): Promise<ActionResult<VehicleWithCustomer[]>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    let query = supabase
      .from("vehicles")
      .select("*, customers(*)")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(
        `plate_number.ilike.${term},brand.ilike.${term},model.ilike.${term},chassis_number.ilike.${term}`
      );
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as VehicleWithCustomer[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch vehicles",
    };
  }
}

export async function getVehicle(
  id: string
): Promise<ActionResult<VehicleWithCustomer>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("vehicles")
      .select("*, customers(*)")
      .eq("id", id)
      .eq("shop_id", shopId)
      .single();

    if (error || !data) {
      return { success: false, error: "Vehicle not found" };
    }

    return { success: true, data: data as VehicleWithCustomer };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch vehicle",
    };
  }
}

export async function createVehicle(
  values: VehicleFormValues
): Promise<ActionResult<Vehicle>> {
  try {
    const parsed = vehicleFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getShopId();
    const supabase = await createClient();

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", parsed.data.customer_id)
      .eq("shop_id", shopId)
      .single();

    if (customerError || !customer) {
      return { success: false, error: "Customer not found in your shop" };
    }

    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        shop_id: shopId,
        customer_id: parsed.data.customer_id,
        plate_number: parsed.data.plate_number,
        brand: parsed.data.brand,
        model: parsed.data.model,
        unit: parsed.data.unit || null,
        year_model:
          parsed.data.year_model === "" ? null : parsed.data.year_model,
        chassis_number: parsed.data.chassis_number || null,
        engine_number: parsed.data.engine_number || null,
        color: parsed.data.color || null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/vehicles");
    revalidatePath("/dashboard/customers");
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create vehicle",
    };
  }
}

export async function updateVehicle(
  id: string,
  values: VehicleFormValues
): Promise<ActionResult<Vehicle>> {
  try {
    const parsed = vehicleFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getShopId();
    const supabase = await createClient();

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", parsed.data.customer_id)
      .eq("shop_id", shopId)
      .single();

    if (customerError || !customer) {
      return { success: false, error: "Customer not found in your shop" };
    }

    const { data, error } = await supabase
      .from("vehicles")
      .update({
        customer_id: parsed.data.customer_id,
        plate_number: parsed.data.plate_number,
        brand: parsed.data.brand,
        model: parsed.data.model,
        unit: parsed.data.unit || null,
        year_model:
          parsed.data.year_model === "" ? null : parsed.data.year_model,
        chassis_number: parsed.data.chassis_number || null,
        engine_number: parsed.data.engine_number || null,
        color: parsed.data.color || null,
      })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/vehicles");
    revalidatePath("/dashboard/customers");
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update vehicle",
    };
  }
}

export async function deleteVehicle(id: string): Promise<ActionResult> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { error } = await supabase
      .from("vehicles")
      .delete()
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/vehicles");
    revalidatePath("/dashboard/customers");
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete vehicle",
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
