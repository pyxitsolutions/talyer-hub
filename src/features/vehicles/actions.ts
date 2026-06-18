"use server";

import { revalidatePath } from "next/cache";

import { assertCustomerIsActive } from "@/features/customers/customer-history";
import { getShopId } from "@/lib/auth";
import {
  assertCanDeactivateVehicle,
  findActiveEstimateForVehicle,
} from "@/lib/estimates/active-estimate";
import { createClient } from "@/lib/supabase/server";
import type { Customer, Vehicle } from "@/types/database";
import { vehicleFormSchema, type VehicleFormValues } from "./schemas";
import {
  getVehicleHistoryCounts,
  vehicleHasHistory,
} from "./vehicle-history";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface VehicleWithCustomer extends Vehicle {
  customers: Customer;
}

export interface VehicleRemovalInfo {
  hasHistory: boolean;
  isActive: boolean;
  customerIsActive: boolean;
  canDeactivate: boolean;
  openEstimateNumber: string | null;
  historyCounts: {
    estimates: number;
    jobOrders: number;
    invoices: number;
    unitsReceived: number;
  };
}

export async function getVehicles(
  search?: string,
  options?: { activeOnly?: boolean }
): Promise<ActionResult<VehicleWithCustomer[]>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    let query = supabase
      .from("vehicles")
      .select("*, customers(*)")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });

    if (options?.activeOnly) {
      query = query.eq("is_active", true);
    }

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

    const customerActiveCheck = await assertCustomerIsActive(
      supabase,
      shopId,
      parsed.data.customer_id
    );
    if (!customerActiveCheck.ok) {
      return { success: false, error: customerActiveCheck.error };
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

    const { data: existingVehicle, error: existingVehicleError } =
      await supabase
        .from("vehicles")
        .select("is_active, customer_id, customers(is_active)")
        .eq("id", id)
        .eq("shop_id", shopId)
        .maybeSingle();

    if (existingVehicleError || !existingVehicle) {
      return { success: false, error: "Vehicle not found" };
    }

    if (!existingVehicle.is_active) {
      return {
        success: false,
        error:
          "This vehicle is inactive. Reactivate it before making changes.",
      };
    }

    const ownerRaw = existingVehicle.customers as unknown as
      | { is_active: boolean }
      | { is_active: boolean }[]
      | null;
    const owner = Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw;
    if (!owner?.is_active) {
      return {
        success: false,
        error:
          "This vehicle belongs to an inactive customer. Reactivate the customer first.",
      };
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", parsed.data.customer_id)
      .eq("shop_id", shopId)
      .single();

    if (customerError || !customer) {
      return { success: false, error: "Customer not found in your shop" };
    }

    const customerActiveCheck = await assertCustomerIsActive(
      supabase,
      shopId,
      parsed.data.customer_id
    );
    if (!customerActiveCheck.ok) {
      return { success: false, error: customerActiveCheck.error };
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

    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id, is_active")
      .eq("id", id)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (vehicleError || !vehicle) {
      return { success: false, error: "Vehicle not found" };
    }

    const historyCounts = await getVehicleHistoryCounts(supabase, shopId, id);
    if (vehicleHasHistory(historyCounts)) {
      return {
        success: false,
        error:
          "This vehicle has service history and cannot be deleted. Deactivate it instead to hide it from new transactions.",
      };
    }

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

export async function deactivateVehicle(id: string): Promise<ActionResult<Vehicle>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id, customer_id")
      .eq("id", id)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (vehicleError || !vehicle) {
      return { success: false, error: "Vehicle not found" };
    }

    const deactivateCheck = await assertCanDeactivateVehicle(
      supabase,
      shopId,
      vehicle.customer_id,
      id
    );
    if (!deactivateCheck.ok) {
      return { success: false, error: deactivateCheck.error };
    }

    const { data, error } = await supabase
      .from("vehicles")
      .update({ is_active: false })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Vehicle not found",
      };
    }

    revalidatePath("/dashboard/vehicles");
    revalidatePath("/dashboard/customers");
    return { success: true, data: data as Vehicle };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to deactivate vehicle",
    };
  }
}

export async function reactivateVehicle(id: string): Promise<ActionResult<Vehicle>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id, customer_id")
      .eq("id", id)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (vehicleError || !vehicle) {
      return { success: false, error: "Vehicle not found" };
    }

    const customerActiveCheck = await assertCustomerIsActive(
      supabase,
      shopId,
      vehicle.customer_id
    );
    if (!customerActiveCheck.ok) {
      return { success: false, error: customerActiveCheck.error };
    }

    const { data, error } = await supabase
      .from("vehicles")
      .update({ is_active: true })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Vehicle not found",
      };
    }

    revalidatePath("/dashboard/vehicles");
    revalidatePath("/dashboard/customers");
    return { success: true, data: data as Vehicle };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to reactivate vehicle",
    };
  }
}

export async function getVehicleRemovalInfo(
  id: string
): Promise<ActionResult<VehicleRemovalInfo>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id, is_active, customer_id, customers(is_active)")
      .eq("id", id)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (vehicleError || !vehicle) {
      return { success: false, error: "Vehicle not found" };
    }

    const customerRaw = vehicle.customers as unknown as
      | { is_active: boolean }
      | { is_active: boolean }[]
      | null;
    const customer = Array.isArray(customerRaw) ? customerRaw[0] : customerRaw;
    const historyCounts = await getVehicleHistoryCounts(supabase, shopId, id);
    const openEstimate = await findActiveEstimateForVehicle(
      supabase,
      shopId,
      vehicle.customer_id,
      id
    );
    const hasHistory = vehicleHasHistory(historyCounts);

    return {
      success: true,
      data: {
        hasHistory,
        isActive: vehicle.is_active,
        customerIsActive: customer?.is_active ?? false,
        canDeactivate: hasHistory && !openEstimate,
        openEstimateNumber: openEstimate?.estimate_number ?? null,
        historyCounts,
      },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to check vehicle history",
    };
  }
}
