"use server";

import { revalidatePath } from "next/cache";

import { getShopId } from "@/lib/auth";
import {
  assertCanDeactivateCustomer,
  findOpenEstimatesForCustomer,
  type OpenEstimateSummary,
} from "@/lib/estimates/active-estimate";
import { createClient } from "@/lib/supabase/server";
import { generateNumber } from "@/lib/utils";
import type {
  Customer,
  Invoice,
  JobOrder,
  RepairEstimate,
  Vehicle,
} from "@/types/database";
import {
  customerFormSchema,
  resolveCustomerFullName,
  type CustomerFormValues,
} from "./schemas";
import {
  customerHasHistory,
  getCustomerHistoryCounts,
} from "./customer-history";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface CustomerHistory {
  estimates: RepairEstimate[];
  jobOrders: JobOrder[];
  invoices: Invoice[];
}

export interface CustomerWithVehicles extends Customer {
  vehicles: Vehicle[];
}

export interface CustomerRemovalInfo {
  hasHistory: boolean;
  isActive: boolean;
  canDeactivate: boolean;
  openEstimates: OpenEstimateSummary[];
  historyCounts: {
    estimates: number;
    jobOrders: number;
    invoices: number;
    unitsReceived: number;
    vehiclesWithHistory: number;
  };
}

export async function getCustomers(
  search?: string,
  options?: { activeOnly?: boolean }
): Promise<ActionResult<Customer[]>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    let query = supabase
      .from("customers")
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });

    if (options?.activeOnly) {
      query = query.eq("is_active", true);
    }

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(
        `full_name.ilike.${term},customer_number.ilike.${term},contact_number.ilike.${term},email.ilike.${term}`
      );
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as Customer[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch customers",
    };
  }
}

export async function getCustomer(
  id: string
): Promise<ActionResult<CustomerWithVehicles>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .eq("shop_id", shopId)
      .single();

    if (customerError || !customer) {
      return { success: false, error: "Customer not found" };
    }

    const { data: vehicles, error: vehiclesError } = await supabase
      .from("vehicles")
      .select("*")
      .eq("customer_id", id)
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });

    if (vehiclesError) {
      return { success: false, error: vehiclesError.message };
    }

    return {
      success: true,
      data: { ...(customer as Customer), vehicles: (vehicles ?? []) as Vehicle[] },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch customer",
    };
  }
}

export async function createCustomer(
  values: CustomerFormValues
): Promise<ActionResult<Customer>> {
  try {
    const parsed = customerFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getShopId();
    const supabase = await createClient();

    const { count, error: countError } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("shop_id", shopId);

    if (countError) {
      return { success: false, error: countError.message };
    }

    const customerNumber = generateNumber("CUST", count ?? 0);

    const { data, error } = await supabase
      .from("customers")
      .insert({
        shop_id: shopId,
        customer_number: customerNumber,
        full_name: resolveCustomerFullName(parsed.data),
        contact_number: parsed.data.contact_number?.trim() || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/customers");
    return { success: true, data: data as Customer };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create customer",
    };
  }
}

export async function updateCustomer(
  id: string,
  values: CustomerFormValues
): Promise<ActionResult<Customer>> {
  try {
    const parsed = customerFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getShopId();
    const supabase = await createClient();

    const { data: existing, error: existingError } = await supabase
      .from("customers")
      .select("is_active")
      .eq("id", id)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (existingError || !existing) {
      return { success: false, error: "Customer not found" };
    }

    if (!existing.is_active) {
      return {
        success: false,
        error:
          "This customer is inactive. Reactivate them before making changes.",
      };
    }

    const { data, error } = await supabase
      .from("customers")
      .update({
        full_name: resolveCustomerFullName(parsed.data),
        contact_number: parsed.data.contact_number?.trim() || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
      })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/customers");
    revalidatePath(`/dashboard/customers/${id}`);
    return { success: true, data: data as Customer };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update customer",
    };
  }
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", id)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (customerError || !customer) {
      return { success: false, error: "Customer not found" };
    }

    const historyCounts = await getCustomerHistoryCounts(supabase, shopId, id);
    if (customerHasHistory(historyCounts)) {
      return {
        success: false,
        error:
          "This customer has service history and cannot be deleted. Deactivate them instead to hide them from new transactions.",
      };
    }

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/customers");
    revalidatePath("/dashboard/vehicles");
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete customer",
    };
  }
}

export async function deactivateCustomer(
  id: string
): Promise<ActionResult<Customer>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const deactivateCheck = await assertCanDeactivateCustomer(
      supabase,
      shopId,
      id
    );
    if (!deactivateCheck.ok) {
      return { success: false, error: deactivateCheck.error };
    }

    const { data, error } = await supabase
      .from("customers")
      .update({ is_active: false })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Customer not found",
      };
    }

    await supabase
      .from("vehicles")
      .update({ is_active: false })
      .eq("customer_id", id)
      .eq("shop_id", shopId);

    revalidatePath("/dashboard/customers");
    revalidatePath("/dashboard/vehicles");
    revalidatePath(`/dashboard/customers/${id}`);
    return { success: true, data: data as Customer };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to deactivate customer",
    };
  }
}

export async function reactivateCustomer(
  id: string
): Promise<ActionResult<Customer>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("customers")
      .update({ is_active: true })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Customer not found",
      };
    }

    await supabase
      .from("vehicles")
      .update({ is_active: true })
      .eq("customer_id", id)
      .eq("shop_id", shopId);

    revalidatePath("/dashboard/customers");
    revalidatePath("/dashboard/vehicles");
    revalidatePath(`/dashboard/customers/${id}`);
    return { success: true, data: data as Customer };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to reactivate customer",
    };
  }
}

export async function getCustomerRemovalInfo(
  id: string
): Promise<ActionResult<CustomerRemovalInfo>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, is_active")
      .eq("id", id)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (customerError || !customer) {
      return { success: false, error: "Customer not found" };
    }

    const historyCounts = await getCustomerHistoryCounts(supabase, shopId, id);
    const openEstimates = await findOpenEstimatesForCustomer(
      supabase,
      shopId,
      id
    );
    const hasHistory = customerHasHistory(historyCounts);

    return {
      success: true,
      data: {
        hasHistory,
        isActive: customer.is_active,
        canDeactivate: hasHistory && openEstimates.length === 0,
        openEstimates,
        historyCounts,
      },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to check customer history",
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
      .eq("is_active", true)
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

export async function getCustomerHistory(
  customerId: string
): Promise<ActionResult<CustomerHistory>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const [estimatesResult, jobOrdersResult, invoicesResult] =
      await Promise.all([
        supabase
          .from("repair_estimates")
          .select("*, vehicles(plate_number, brand, model)")
          .eq("customer_id", customerId)
          .eq("shop_id", shopId)
          .order("estimate_date", { ascending: false }),
        supabase
          .from("job_orders")
          .select("*, vehicles(plate_number, brand, model)")
          .eq("customer_id", customerId)
          .eq("shop_id", shopId)
          .order("created_at", { ascending: false }),
        supabase
          .from("invoices")
          .select("*, vehicles(plate_number, brand, model)")
          .eq("customer_id", customerId)
          .eq("shop_id", shopId)
          .order("invoice_date", { ascending: false }),
      ]);

    if (estimatesResult.error) {
      return { success: false, error: estimatesResult.error.message };
    }
    if (jobOrdersResult.error) {
      return { success: false, error: jobOrdersResult.error.message };
    }
    if (invoicesResult.error) {
      return { success: false, error: invoicesResult.error.message };
    }

    return {
      success: true,
      data: {
        estimates: (estimatesResult.data ?? []) as RepairEstimate[],
        jobOrders: (jobOrdersResult.data ?? []) as JobOrder[],
        invoices: (invoicesResult.data ?? []) as Invoice[],
      },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to fetch customer history",
    };
  }
}
