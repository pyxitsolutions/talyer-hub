"use server";

import { revalidatePath } from "next/cache";

import { getShopId } from "@/lib/auth";
import { LIST_PAGE_SIZE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { PaginatedResult } from "@/lib/types/pagination";
import {
  buildLastClosedAtByVehicle,
  getUnitLogCutoffDate,
  isUnitLogEligibleForJobOrder,
} from "@/lib/units/job-order-eligibility";
import { generateNumber } from "@/lib/utils";
import type {
  Customer,
  JobOrder,
  JobOrderPart,
  RepairEstimate,
  Vehicle,
} from "@/types/database";
import {
  jobOrderCreateFormSchema,
  jobOrderFormSchema,
  type JobOrderFormValues,
  type JobOrderPartValues,
} from "./schemas";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface JobOrderWithRelations extends Omit<JobOrder, "repair_estimates"> {
  customers: Customer;
  vehicles: Vehicle;
  job_order_parts: JobOrderPart[];
  repair_estimates?: RepairEstimate | null;
  invoices?: { invoice_number: string }[] | null;
}

export interface JobOrderListItem extends Omit<
  JobOrder,
  "repair_estimates" | "customers" | "vehicles"
> {
  customers?: Pick<Customer, "full_name"> | null;
  vehicles?: Pick<Vehicle, "plate_number" | "brand" | "model"> | null;
  repair_estimates?: Pick<RepairEstimate, "estimate_number"> | null;
  invoices?: { invoice_number: string }[] | null;
}

interface InventoryDeduction {
  inventory_item_id: string;
  quantity: number;
}

async function getLastClosedAtByVehicle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  vehicleIds: string[]
): Promise<Map<string, string>> {
  if (vehicleIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("job_orders")
    .select("vehicle_id, updated_at")
    .eq("shop_id", shopId)
    .in("vehicle_id", vehicleIds)
    .in("status", ["completed", "released"])
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return buildLastClosedAtByVehicle(data ?? []);
}

async function getLinkedInvoice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  jobOrderId: string
) {
  return supabase
    .from("invoices")
    .select("invoice_number, payment_status")
    .eq("job_order_id", jobOrderId)
    .eq("shop_id", shopId)
    .maybeSingle();
}

async function assertUnitReceivedForJobOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  unitReceivedId: string,
  customerId: string,
  vehicleId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: unit, error } = await supabase
    .from("units_received")
    .select("id, customer_id, vehicle_id, job_order_id, received_date, created_at")
    .eq("id", unitReceivedId)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (error || !unit) {
    return { ok: false, error: "Unit received record not found" };
  }

  if (unit.job_order_id) {
    return {
      ok: false,
      error: "This unit log is already linked to a job order.",
    };
  }

  if (!unit.vehicle_id) {
    return {
      ok: false,
      error:
        "Unit log must include a vehicle before creating a job order. Update the unit log in Units Received.",
    };
  }

  if (unit.vehicle_id !== vehicleId) {
    return {
      ok: false,
      error: "Selected unit log does not match the job order vehicle.",
    };
  }

  if (unit.customer_id && unit.customer_id !== customerId) {
    return {
      ok: false,
      error: "Selected unit log does not match the job order customer.",
    };
  }

  const lastClosedAtByVehicle = await getLastClosedAtByVehicle(supabase, shopId, [
    unit.vehicle_id,
  ]);

  if (
    !isUnitLogEligibleForJobOrder(unit, lastClosedAtByVehicle, getUnitLogCutoffDate())
  ) {
    return {
      ok: false,
      error:
        "This unit log is no longer available for a new job order. Log the unit again in Units Received for the current visit.",
    };
  }

  return { ok: true };
}

async function linkUnitReceivedToJobOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  unitReceivedId: string,
  jobOrderId: string,
  customerId: string,
  vehicleId: string
) {
  const { error } = await supabase
    .from("units_received")
    .update({
      job_order_id: jobOrderId,
      customer_id: customerId,
      vehicle_id: vehicleId,
    })
    .eq("id", unitReceivedId)
    .eq("shop_id", shopId);

  if (error) {
    throw new Error(error.message);
  }
}

async function assertCanDeleteJobOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  jobOrderId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: jobOrder, error: jobOrderError } = await supabase
    .from("job_orders")
    .select("status")
    .eq("id", jobOrderId)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (jobOrderError || !jobOrder) {
    return {
      ok: false,
      error: jobOrderError?.message ?? "Job order not found",
    };
  }

  if (jobOrder.status === "released") {
    return {
      ok: false,
      error:
        "Cannot delete job order: vehicle has already been released. This record is locked.",
    };
  }

  const { data: invoice, error } = await getLinkedInvoice(
    supabase,
    shopId,
    jobOrderId
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  if (invoice) {
    return {
      ok: false,
      error: `Cannot delete job order: invoice ${invoice.invoice_number} is linked. Delete or unlink the invoice first, or wait until before invoicing.`,
    };
  }

  return { ok: true };
}

async function assertCanReleaseJobOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  jobOrderId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: invoice, error } = await getLinkedInvoice(
    supabase,
    shopId,
    jobOrderId
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!invoice) {
    return {
      ok: false,
      error:
        "Cannot release vehicle: generate and pay the invoice first.",
    };
  }

  if (invoice.payment_status !== "paid") {
    return {
      ok: false,
      error: `Cannot release vehicle: invoice ${invoice.invoice_number} must be fully paid (current: ${invoice.payment_status}).`,
    };
  }

  return { ok: true };
}

export async function getJobOrderReleaseEligibility(
  jobOrderId: string
): Promise<ActionResult<{ canRelease: boolean; message: string }>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();
    const result = await assertCanReleaseJobOrder(supabase, shopId, jobOrderId);

    if (result.ok) {
      return {
        success: true,
        data: {
          canRelease: true,
          message: "Invoice is paid. Vehicle can be released.",
        },
      };
    }

    return {
      success: true,
      data: { canRelease: false, message: result.error },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to check release eligibility",
    };
  }
}

export async function getJobOrderDeleteEligibility(
  jobOrderId: string
): Promise<ActionResult<{ canDelete: boolean; message: string }>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();
    const result = await assertCanDeleteJobOrder(supabase, shopId, jobOrderId);

    if (result.ok) {
      return {
        success: true,
        data: {
          canDelete: true,
          message:
            "This job order can be deleted. Released records and job orders with linked invoices cannot be deleted.",
        },
      };
    }

    return {
      success: true,
      data: { canDelete: false, message: result.error },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to check delete eligibility",
    };
  }
}

async function deductInventory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  parts: InventoryDeduction[],
  referenceType: string,
  referenceId: string
) {
  for (const part of parts) {
    const { data: invItem, error: fetchError } = await supabase
      .from("inventory_items")
      .select("quantity, part_name")
      .eq("id", part.inventory_item_id)
      .eq("shop_id", shopId)
      .single();

    if (fetchError || !invItem) {
      throw new Error("Inventory item not found");
    }

    if (invItem.quantity < part.quantity) {
      throw new Error(`Insufficient stock for ${invItem.part_name}`);
    }

    const { error: updateError } = await supabase
      .from("inventory_items")
      .update({ quantity: invItem.quantity - part.quantity })
      .eq("id", part.inventory_item_id)
      .eq("shop_id", shopId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { error: txError } = await supabase
      .from("inventory_transactions")
      .insert({
        shop_id: shopId,
        inventory_item_id: part.inventory_item_id,
        transaction_type: "stock_out",
        quantity: part.quantity,
        reference_type: referenceType,
        reference_id: referenceId,
        notes: `Deducted for job order`,
      });

    if (txError) {
      throw new Error(txError.message);
    }
  }
}

async function restoreInventory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  parts: InventoryDeduction[],
  referenceType: string,
  referenceId: string
) {
  for (const part of parts) {
    const { data: invItem, error: fetchError } = await supabase
      .from("inventory_items")
      .select("quantity")
      .eq("id", part.inventory_item_id)
      .eq("shop_id", shopId)
      .single();

    if (fetchError || !invItem) continue;

    await supabase
      .from("inventory_items")
      .update({ quantity: invItem.quantity + part.quantity })
      .eq("id", part.inventory_item_id)
      .eq("shop_id", shopId);

    await supabase.from("inventory_transactions").insert({
      shop_id: shopId,
      inventory_item_id: part.inventory_item_id,
      transaction_type: "stock_in",
      quantity: part.quantity,
      reference_type: referenceType,
      reference_id: referenceId,
      notes: `Restored from job order update/delete`,
    });
  }
}

function getInventoryParts(
  parts: JobOrderPartValues[]
): InventoryDeduction[] {
  return parts
    .filter((p) => p.inventory_item_id)
    .map((p) => ({
      inventory_item_id: p.inventory_item_id!,
      quantity: p.quantity,
    }));
}

async function insertJobOrderParts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  jobOrderId: string,
  parts: JobOrderPartValues[]
) {
  if (parts.length === 0) return;

  const { error } = await supabase.from("job_order_parts").insert(
    parts.map((part) => ({
      shop_id: shopId,
      job_order_id: jobOrderId,
      part_name: part.part_name,
      quantity: part.quantity,
      unit_price: part.unit_price,
      total_price: part.quantity * part.unit_price,
      inventory_item_id: part.inventory_item_id || null,
    }))
  );

  if (error) throw new Error(error.message);
}

export async function getJobOrders(
  search?: string,
  page = 1,
  pageSize = LIST_PAGE_SIZE
): Promise<ActionResult<PaginatedResult<JobOrderListItem>>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(pageSize, 100));
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;

    let query = supabase
      .from("job_orders")
      .select(
        "id, shop_id, job_order_number, estimate_id, customer_id, vehicle_id, assigned_technician, date_started, date_completed, status, repair_description, created_at, updated_at, customers(full_name), vehicles(plate_number, brand, model), repair_estimates(estimate_number), invoices(invoice_number)",
        { count: "exact" }
      )
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(
        `job_order_number.ilike.${term},assigned_technician.ilike.${term}`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        items: (data ?? []) as unknown as JobOrderListItem[],
        total: count ?? 0,
        page: safePage,
        pageSize: safePageSize,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch job orders",
    };
  }
}

export async function getJobOrder(
  id: string
): Promise<ActionResult<JobOrderWithRelations>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("job_orders")
      .select(
        "*, customers(*), vehicles(*), job_order_parts(*), repair_estimates(*), invoices(invoice_number)"
      )
      .eq("id", id)
      .eq("shop_id", shopId)
      .single();

    if (error || !data) {
      return { success: false, error: "Job order not found" };
    }

    return { success: true, data: data as JobOrderWithRelations };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch job order",
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

export interface UnitReceivedForJobOrderOption {
  id: string;
  received_date: string;
  category: string;
  notes: string | null;
}

export interface ApprovedEstimateForJobOrderOption {
  id: string;
  estimate_number: string;
  estimate_date: string;
  customer_id: string;
  vehicle_id: string;
  customers: Pick<Customer, "full_name"> | null;
  vehicles: Pick<Vehicle, "plate_number" | "brand" | "model"> | null;
}

async function resolveEligibleUnitReceivedId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  customerId: string,
  vehicleId: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const unitsResult = await getAvailableUnitsForJobOrderInternal(
    supabase,
    shopId,
    vehicleId
  );

  if (!unitsResult.success) {
    return { ok: false, error: unitsResult.error };
  }

  if (unitsResult.data.length === 0) {
    return {
      ok: false,
      error:
        "No current unit log is available for this vehicle. Log the unit in Units Received for this visit before creating a job order.",
    };
  }

  const unitReceivedId = unitsResult.data[0].id;
  const unitCheck = await assertUnitReceivedForJobOrder(
    supabase,
    shopId,
    unitReceivedId,
    customerId,
    vehicleId
  );

  if (!unitCheck.ok) {
    return unitCheck;
  }

  return { ok: true, id: unitReceivedId };
}

async function getAvailableUnitsForJobOrderInternal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  vehicleId: string
): Promise<ActionResult<UnitReceivedForJobOrderOption[]>> {
  if (!vehicleId) {
    return { success: true, data: [] };
  }

  const cutoffDate = getUnitLogCutoffDate();

  const { data, error } = await supabase
    .from("units_received")
    .select("id, received_date, category, notes, created_at, job_order_id, vehicle_id")
    .eq("shop_id", shopId)
    .eq("vehicle_id", vehicleId)
    .is("job_order_id", null)
    .gte("received_date", cutoffDate)
    .order("received_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  const lastClosedAtByVehicle = await getLastClosedAtByVehicle(supabase, shopId, [
    vehicleId,
  ]);

  const eligibleUnits = (data ?? [])
    .filter((unit) =>
      isUnitLogEligibleForJobOrder(unit, lastClosedAtByVehicle, cutoffDate)
    )
    .map(({ id, received_date, category, notes }) => ({
      id,
      received_date,
      category,
      notes,
    }));

  return { success: true, data: eligibleUnits };
}

export async function getApprovedEstimatesForJobOrder(): Promise<
  ActionResult<ApprovedEstimateForJobOrderOption[]>
> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const [{ data: estimates, error: estimatesError }, { data: jobOrders, error: jobOrdersError }] =
      await Promise.all([
        supabase
          .from("repair_estimates")
          .select(
            "id, estimate_number, estimate_date, customer_id, vehicle_id, customers(full_name), vehicles(plate_number, brand, model)"
          )
          .eq("shop_id", shopId)
          .eq("status", "approved")
          .order("estimate_date", { ascending: false }),
        supabase
          .from("job_orders")
          .select("estimate_id")
          .eq("shop_id", shopId)
          .not("estimate_id", "is", null),
      ]);

    if (estimatesError) {
      return { success: false, error: estimatesError.message };
    }

    if (jobOrdersError) {
      return { success: false, error: jobOrdersError.message };
    }

    const usedEstimateIds = new Set(
      (jobOrders ?? [])
        .map((row) => row.estimate_id)
        .filter((id): id is string => Boolean(id))
    );

    const availableEstimates: ApprovedEstimateForJobOrderOption[] = (
      estimates ?? []
    )
      .filter((estimate) => !usedEstimateIds.has(estimate.id))
      .map((estimate) => {
        const customer = Array.isArray(estimate.customers)
          ? estimate.customers[0]
          : estimate.customers;
        const vehicle = Array.isArray(estimate.vehicles)
          ? estimate.vehicles[0]
          : estimate.vehicles;

        return {
          id: estimate.id,
          estimate_number: estimate.estimate_number,
          estimate_date: estimate.estimate_date,
          customer_id: estimate.customer_id,
          vehicle_id: estimate.vehicle_id,
          customers: customer
            ? { full_name: customer.full_name as string }
            : null,
          vehicles: vehicle
            ? {
                plate_number: vehicle.plate_number as string,
                brand: vehicle.brand as string,
                model: vehicle.model as string,
              }
            : null,
        };
      });

    return { success: true, data: availableEstimates };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to fetch approved estimates",
    };
  }
}

export async function getAvailableUnitsForJobOrder(
  vehicleId: string
): Promise<ActionResult<UnitReceivedForJobOrderOption[]>> {
  try {
    if (!vehicleId) {
      return { success: true, data: [] };
    }

    const shopId = await getShopId();
    const supabase = await createClient();
    return getAvailableUnitsForJobOrderInternal(supabase, shopId, vehicleId);
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to fetch available unit logs",
    };
  }
}

export async function getInventoryForSelect() {
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

export async function createJobOrder(
  values: JobOrderFormValues
): Promise<ActionResult<JobOrder>> {
  try {
    const parsed = jobOrderCreateFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getShopId();
    const supabase = await createClient();

    if (parsed.data.status === "released") {
      return {
        success: false,
        error:
          "Cannot release on create. Complete the job, generate invoice, and record payment first.",
      };
    }

    const { data: estimate, error: estimateError } = await supabase
      .from("repair_estimates")
      .select("id, customer_id, vehicle_id, status")
      .eq("id", parsed.data.estimate_id)
      .eq("shop_id", shopId)
      .single();

    if (estimateError || !estimate) {
      return { success: false, error: "Estimate not found" };
    }

    if (estimate.status !== "approved") {
      return {
        success: false,
        error: "Only approved estimates can be used for job orders",
      };
    }

    const { data: existingJobOrder } = await supabase
      .from("job_orders")
      .select("id")
      .eq("estimate_id", parsed.data.estimate_id)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (existingJobOrder) {
      return {
        success: false,
        error: "A job order already exists for this estimate",
      };
    }

    if (
      parsed.data.customer_id !== estimate.customer_id ||
      parsed.data.vehicle_id !== estimate.vehicle_id
    ) {
      return {
        success: false,
        error: "Customer and vehicle must match the selected estimate",
      };
    }

    let unitReceivedId: string;

    if (parsed.data.unit_received_id) {
      const unitCheck = await assertUnitReceivedForJobOrder(
        supabase,
        shopId,
        parsed.data.unit_received_id,
        parsed.data.customer_id,
        parsed.data.vehicle_id
      );

      if (!unitCheck.ok) {
        return { success: false, error: unitCheck.error };
      }

      unitReceivedId = parsed.data.unit_received_id;
    } else {
      const unitResolution = await resolveEligibleUnitReceivedId(
        supabase,
        shopId,
        parsed.data.customer_id,
        parsed.data.vehicle_id
      );

      if (!unitResolution.ok) {
        return { success: false, error: unitResolution.error };
      }

      unitReceivedId = unitResolution.id;
    }

    const { count, error: countError } = await supabase
      .from("job_orders")
      .select("*", { count: "exact", head: true })
      .eq("shop_id", shopId);

    if (countError) {
      return { success: false, error: countError.message };
    }

    const jobOrderNumber = generateNumber("JO", count ?? 0);
    const inventoryParts = getInventoryParts(parsed.data.parts);

    const { data, error } = await supabase
      .from("job_orders")
      .insert({
        shop_id: shopId,
        job_order_number: jobOrderNumber,
        estimate_id: parsed.data.estimate_id || null,
        customer_id: parsed.data.customer_id,
        vehicle_id: parsed.data.vehicle_id,
        assigned_technician: parsed.data.assigned_technician || null,
        date_started: parsed.data.date_started || null,
        date_completed: parsed.data.date_completed || null,
        status: parsed.data.status,
        repair_description: parsed.data.repair_description || null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await insertJobOrderParts(supabase, shopId, data.id, parsed.data.parts);

    if (inventoryParts.length > 0) {
      await deductInventory(
        supabase,
        shopId,
        inventoryParts,
        "job_order",
        data.id
      );
    }

    await linkUnitReceivedToJobOrder(
      supabase,
      shopId,
      unitReceivedId,
      data.id,
      parsed.data.customer_id,
      parsed.data.vehicle_id
    );

    revalidatePath("/dashboard/job-orders");
    revalidatePath("/dashboard/units-received");
    revalidatePath("/dashboard/estimates");
    revalidatePath(`/dashboard/estimates/${parsed.data.estimate_id}`);
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard");
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create job order",
    };
  }
}

export async function updateJobOrder(
  id: string,
  values: JobOrderFormValues
): Promise<ActionResult<JobOrder>> {
  try {
    const parsed = jobOrderFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getShopId();
    const supabase = await createClient();

    const { data: existingParts, error: partsError } = await supabase
      .from("job_order_parts")
      .select("inventory_item_id, quantity")
      .eq("job_order_id", id)
      .eq("shop_id", shopId);

    if (partsError) {
      return { success: false, error: partsError.message };
    }

    if (parsed.data.status === "released") {
      const releaseCheck = await assertCanReleaseJobOrder(supabase, shopId, id);
      if (!releaseCheck.ok) {
        return { success: false, error: releaseCheck.error };
      }
    }

    const oldInventoryParts = (existingParts ?? [])
      .filter((p) => p.inventory_item_id)
      .map((p) => ({
        inventory_item_id: p.inventory_item_id!,
        quantity: Number(p.quantity),
      }));

    const { data, error } = await supabase
      .from("job_orders")
      .update({
        estimate_id: parsed.data.estimate_id || null,
        customer_id: parsed.data.customer_id,
        vehicle_id: parsed.data.vehicle_id,
        assigned_technician: parsed.data.assigned_technician || null,
        date_started: parsed.data.date_started || null,
        date_completed: parsed.data.date_completed || null,
        status: parsed.data.status,
        repair_description: parsed.data.repair_description || null,
      })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (oldInventoryParts.length > 0) {
      await restoreInventory(
        supabase,
        shopId,
        oldInventoryParts,
        "job_order",
        id
      );
    }

    const { error: deleteError } = await supabase
      .from("job_order_parts")
      .delete()
      .eq("job_order_id", id)
      .eq("shop_id", shopId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    await insertJobOrderParts(supabase, shopId, id, parsed.data.parts);

    const newInventoryParts = getInventoryParts(parsed.data.parts);
    if (newInventoryParts.length > 0) {
      await deductInventory(
        supabase,
        shopId,
        newInventoryParts,
        "job_order",
        id
      );
    }

    revalidatePath("/dashboard/job-orders");
    revalidatePath(`/dashboard/job-orders/${id}`);
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard");
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update job order",
    };
  }
}

export async function deleteJobOrder(id: string): Promise<ActionResult> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const deleteCheck = await assertCanDeleteJobOrder(supabase, shopId, id);
    if (!deleteCheck.ok) {
      return { success: false, error: deleteCheck.error };
    }

    const { data: existingParts, error: partsError } = await supabase
      .from("job_order_parts")
      .select("inventory_item_id, quantity")
      .eq("job_order_id", id)
      .eq("shop_id", shopId);

    if (partsError) {
      return { success: false, error: partsError.message };
    }

    const inventoryParts = (existingParts ?? [])
      .filter((p) => p.inventory_item_id)
      .map((p) => ({
        inventory_item_id: p.inventory_item_id!,
        quantity: Number(p.quantity),
      }));

    if (inventoryParts.length > 0) {
      await restoreInventory(
        supabase,
        shopId,
        inventoryParts,
        "job_order",
        id
      );
    }

    const { error } = await supabase
      .from("job_orders")
      .delete()
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/job-orders");
    revalidatePath("/dashboard/inventory");
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete job order",
    };
  }
}

export async function convertFromEstimate(
  estimateId: string,
  unitReceivedId: string
): Promise<ActionResult<JobOrder>> {
  try {
    if (!unitReceivedId) {
      return {
        success: false,
        error:
          "Log the unit in Units Received before creating a job order.",
      };
    }

    const shopId = await getShopId();
    const supabase = await createClient();

    const { data: estimate, error: estimateError } = await supabase
      .from("repair_estimates")
      .select("*, repair_estimate_items(*)")
      .eq("id", estimateId)
      .eq("shop_id", shopId)
      .single();

    if (estimateError || !estimate) {
      return { success: false, error: "Estimate not found" };
    }

    if (estimate.status !== "approved") {
      return {
        success: false,
        error: "Only approved estimates can be converted to job orders",
      };
    }

    const { data: existingJobOrder } = await supabase
      .from("job_orders")
      .select("id")
      .eq("estimate_id", estimateId)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (existingJobOrder) {
      return {
        success: false,
        error: "A job order already exists for this estimate",
      };
    }

    const unitCheck = await assertUnitReceivedForJobOrder(
      supabase,
      shopId,
      unitReceivedId,
      estimate.customer_id,
      estimate.vehicle_id
    );

    if (!unitCheck.ok) {
      return { success: false, error: unitCheck.error };
    }

    const { count, error: countError } = await supabase
      .from("job_orders")
      .select("*", { count: "exact", head: true })
      .eq("shop_id", shopId);

    if (countError) {
      return { success: false, error: countError.message };
    }

    const jobOrderNumber = generateNumber("JO", count ?? 0);
    const today = new Date().toISOString().split("T")[0];

    const parts: JobOrderPartValues[] = (
      estimate.repair_estimate_items ?? []
    ).map(
      (item: {
        part_name: string;
        quantity: number;
        unit_price: number;
        inventory_item_id: string | null;
      }) => ({
        part_name: item.part_name,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        inventory_item_id: item.inventory_item_id ?? "",
      })
    );

    const inventoryParts = getInventoryParts(parts);

    const { data, error } = await supabase
      .from("job_orders")
      .insert({
        shop_id: shopId,
        job_order_number: jobOrderNumber,
        estimate_id: estimateId,
        customer_id: estimate.customer_id,
        vehicle_id: estimate.vehicle_id,
        assigned_technician: estimate.technician_name,
        date_started: today,
        status: "pending",
        repair_description: estimate.repair_description,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await insertJobOrderParts(supabase, shopId, data.id, parts);

    if (inventoryParts.length > 0) {
      await deductInventory(
        supabase,
        shopId,
        inventoryParts,
        "job_order",
        data.id
      );
    }

    await linkUnitReceivedToJobOrder(
      supabase,
      shopId,
      unitReceivedId,
      data.id,
      estimate.customer_id,
      estimate.vehicle_id
    );

    revalidatePath("/dashboard/job-orders");
    revalidatePath("/dashboard/units-received");
    revalidatePath("/dashboard/estimates");
    revalidatePath(`/dashboard/estimates/${estimateId}`);
    revalidatePath("/dashboard/inventory");
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to convert estimate to job order",
    };
  }
}
