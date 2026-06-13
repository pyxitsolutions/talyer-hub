"use server";

import { revalidatePath } from "next/cache";

import { getShopId } from "@/lib/auth";
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
  type CustomerFormValues,
} from "./schemas";

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

export async function getCustomers(
  search?: string
): Promise<ActionResult<Customer[]>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    let query = supabase
      .from("customers")
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });

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
        full_name: parsed.data.full_name,
        contact_number: parsed.data.contact_number || null,
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

    const { data, error } = await supabase
      .from("customers")
      .update({
        full_name: parsed.data.full_name,
        contact_number: parsed.data.contact_number || null,
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

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/customers");
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete customer",
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
