"use server";

import { revalidatePath } from "next/cache";

import { getShopId } from "@/lib/auth";
import { getActivityActor, logActivity } from "@/lib/activity-log";
import { LIST_PAGE_SIZE } from "@/lib/constants";
import { syncSalesFromInvoice } from "@/lib/sales/sync-from-invoice";
import {
  normalizeInvoiceAmountPaid,
  normalizePaymentDetails,
  validatePaymentDetails,
} from "@/lib/invoices/payment";
import { createClient } from "@/lib/supabase/server";
import type { PaginatedResult } from "@/lib/types/pagination";
import { generateNumber } from "@/lib/utils";
import type {
  Customer,
  Invoice,
  InvoiceItem,
  JobOrder,
  PaymentMethod,
  PaymentStatus,
  Vehicle,
} from "@/types/database";
import {
  invoiceFormSchema,
  paymentUpdateSchema,
  type InvoiceFormValues,
  type PaymentUpdateValues,
} from "./schemas";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface InvoiceWithRelations extends Invoice {
  customers: Customer;
  vehicles: Vehicle;
  invoice_items: InvoiceItem[];
  job_orders?: Pick<JobOrder, "status" | "job_order_number"> | null;
}

export interface InvoiceListItem extends Omit<
  Invoice,
  "customers" | "vehicles" | "invoice_items" | "job_orders"
> {
  customers?: Pick<Customer, "full_name"> | null;
  vehicles?: Pick<Vehicle, "plate_number" | "brand" | "model"> | null;
  job_orders?: Pick<JobOrder, "status" | "job_order_number"> | null;
}

function calculatePaymentStatus(
  amountPaid: number,
  totalAmount: number
): PaymentStatus {
  const appliedPaid = normalizeInvoiceAmountPaid(amountPaid, totalAmount);
  if (appliedPaid <= 0) return "unpaid";
  return "paid";
}

function calculateTotals(laborCost: number, items: { quantity: number; unit_price: number }[]) {
  const partsCost = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );
  return {
    partsCost,
    totalAmount: laborCost + partsCost,
  };
}

function normalizeInvoiceItemForCompare(item: {
  part_name: string;
  quantity: number | string;
  unit_price: number | string;
  inventory_item_id?: string | null;
}) {
  return {
    part_name: item.part_name.trim(),
    quantity: Math.round(Number(item.quantity)),
    unit_price: Number(item.unit_price),
    inventory_item_id: item.inventory_item_id || null,
  };
}

function invoiceItemCompareKey(
  item: ReturnType<typeof normalizeInvoiceItemForCompare>
) {
  return `${item.part_name}|${item.quantity}|${item.unit_price}|${item.inventory_item_id ?? ""}`;
}

function areInvoiceItemsEqual(
  existing: {
    part_name: string;
    quantity: number | string;
    unit_price: number | string;
    inventory_item_id: string | null;
  }[],
  updated: InvoiceFormValues["items"]
): boolean {
  const existingKeys = existing
    .map(normalizeInvoiceItemForCompare)
    .map(invoiceItemCompareKey)
    .sort();
  const updatedKeys = updated
    .map(normalizeInvoiceItemForCompare)
    .map(invoiceItemCompareKey)
    .sort();

  return JSON.stringify(existingKeys) === JSON.stringify(updatedKeys);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed || null;
}

function normalizeOptionalDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.split("T")[0];
}

function hasJobOrderLinkedDetailChanges(
  existing: {
    customer_id: string;
    vehicle_id: string;
    invoice_date: string;
    chassis_number: string | null;
    engine_number: string | null;
    repair_description: string | null;
    recommendation: string | null;
    parts_used: string | null;
    technician_name: string | null;
  },
  parsed: InvoiceFormValues
): boolean {
  return (
    parsed.customer_id !== existing.customer_id ||
    parsed.vehicle_id !== existing.vehicle_id ||
    normalizeOptionalDate(parsed.invoice_date) !==
      normalizeOptionalDate(existing.invoice_date) ||
    normalizeOptionalText(parsed.chassis_number) !==
      normalizeOptionalText(existing.chassis_number) ||
    normalizeOptionalText(parsed.engine_number) !==
      normalizeOptionalText(existing.engine_number) ||
    normalizeOptionalText(parsed.repair_description) !==
      normalizeOptionalText(existing.repair_description) ||
    normalizeOptionalText(parsed.recommendation) !==
      normalizeOptionalText(existing.recommendation) ||
    normalizeOptionalText(parsed.parts_used) !==
      normalizeOptionalText(existing.parts_used) ||
    normalizeOptionalText(parsed.technician_name) !==
      normalizeOptionalText(existing.technician_name)
  );
}

async function getReleasedJobOrderLock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  jobOrderId: string | null
): Promise<{ locked: false } | { locked: true; jobOrderNumber: string }> {
  if (!jobOrderId) {
    return { locked: false };
  }

  const { data: jobOrder, error } = await supabase
    .from("job_orders")
    .select("status, job_order_number")
    .eq("id", jobOrderId)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (jobOrder?.status === "released") {
    return { locked: true, jobOrderNumber: jobOrder.job_order_number };
  }

  return { locked: false };
}

async function assertCanUpdateInvoice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  invoiceId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("job_order_id, invoice_number")
    .eq("id", invoiceId)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (error || !invoice) {
    return { ok: false, error: error?.message ?? "Invoice not found" };
  }

  try {
    const lock = await getReleasedJobOrderLock(
      supabase,
      shopId,
      invoice.job_order_id
    );

    if (lock.locked) {
      return {
        ok: false,
        error: `Cannot update invoice ${invoice.invoice_number}: job order ${lock.jobOrderNumber} is already released. This record is locked.`,
      };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to verify invoice lock",
    };
  }

  return { ok: true };
}

async function assertCanDeleteInvoice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  invoiceId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("job_order_id, invoice_number, payment_status, amount_paid")
    .eq("id", invoiceId)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (error || !invoice) {
    return { ok: false, error: error?.message ?? "Invoice not found" };
  }

  if (invoice.payment_status === "paid" || Number(invoice.amount_paid) > 0) {
    return {
      ok: false,
      error: `Cannot delete invoice ${invoice.invoice_number}: mark it as unpaid first before deleting.`,
    };
  }

  if (!invoice.job_order_id) {
    return { ok: true };
  }

  try {
    const lock = await getReleasedJobOrderLock(
      supabase,
      shopId,
      invoice.job_order_id
    );

    if (lock.locked) {
      return {
        ok: false,
        error: `Cannot delete invoice: job order ${lock.jobOrderNumber} is already released. This record is locked.`,
      };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to verify invoice lock",
    };
  }

  return { ok: true };
}

export async function getInvoiceDeleteEligibility(
  invoiceId: string
): Promise<ActionResult<{ canDelete: boolean; message: string }>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();
    const result = await assertCanDeleteInvoice(supabase, shopId, invoiceId);

    if (result.ok) {
      return {
        success: true,
        data: {
          canDelete: true,
          message:
            "This invoice can be deleted. Paid invoices must be marked unpaid first. Invoices linked to a released job order cannot be deleted or updated.",
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

async function deductInventoryForInvoice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  invoiceId: string,
  items: { inventory_item_id: string | null; part_name: string; quantity: number }[]
) {
  const user = (await supabase.auth.getUser()).data.user;

  for (const item of items) {
    if (!item.inventory_item_id) continue;

    const { data: inventoryItem, error: fetchError } = await supabase
      .from("inventory_items")
      .select("quantity, part_name")
      .eq("id", item.inventory_item_id)
      .eq("shop_id", shopId)
      .single();

    if (fetchError || !inventoryItem) {
      throw new Error(`Inventory item not found: ${item.part_name}`);
    }

    if (inventoryItem.quantity < item.quantity) {
      throw new Error(
        `Insufficient stock for ${inventoryItem.part_name}. Available: ${inventoryItem.quantity}`
      );
    }

    const newQuantity = inventoryItem.quantity - item.quantity;

    const { error: updateError } = await supabase
      .from("inventory_items")
      .update({ quantity: newQuantity })
      .eq("id", item.inventory_item_id)
      .eq("shop_id", shopId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { error: transactionError } = await supabase
      .from("inventory_transactions")
      .insert({
        shop_id: shopId,
        inventory_item_id: item.inventory_item_id,
        transaction_type: "stock_out",
        quantity: item.quantity,
        reference_type: "invoice",
        reference_id: invoiceId,
        notes: `Deducted for invoice`,
        created_by: user?.id ?? null,
      });

    if (transactionError) {
      throw new Error(transactionError.message);
    }
  }
}

export async function getInvoices(
  search?: string,
  page = 1,
  pageSize = LIST_PAGE_SIZE
): Promise<ActionResult<PaginatedResult<InvoiceListItem>>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(pageSize, 100));
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;

    let query = supabase
      .from("invoices")
      .select(
        "id, shop_id, invoice_number, job_order_id, customer_id, vehicle_id, invoice_date, technician_name, labor_cost, parts_cost, total_amount, amount_paid, payment_status, payment_method, verification_code, created_at, updated_at, customers(full_name), vehicles(plate_number, brand, model), job_orders(status, job_order_number)",
        { count: "exact" }
      )
      .eq("shop_id", shopId)
      .order("invoice_date", { ascending: false })
      .range(from, to);

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(
        `invoice_number.ilike.${term},technician_name.ilike.${term}`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        items: (data ?? []) as unknown as InvoiceListItem[],
        total: count ?? 0,
        page: safePage,
        pageSize: safePageSize,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch invoices",
    };
  }
}

export async function getInvoice(
  id: string
): Promise<ActionResult<InvoiceWithRelations>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("invoices")
      .select(
        "*, customers(*), vehicles(*), invoice_items(*), job_orders(status, job_order_number)"
      )
      .eq("id", id)
      .eq("shop_id", shopId)
      .single();

    if (error || !data) {
      return { success: false, error: "Invoice not found" };
    }

    return { success: true, data: data as InvoiceWithRelations };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch invoice",
    };
  }
}

export async function createInvoice(
  values: InvoiceFormValues
): Promise<ActionResult<Invoice>> {
  try {
    const parsed = invoiceFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getShopId();
    const supabase = await createClient();

    if (!parsed.data.job_order_id) {
      return {
        success: false,
        error: "Select a completed job order to create an invoice.",
      };
    }

    const { data: jobOrder, error: jobOrderError } = await supabase
      .from("job_orders")
      .select("id, status, job_order_number")
      .eq("id", parsed.data.job_order_id)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (jobOrderError) {
      return { success: false, error: jobOrderError.message };
    }

    if (!jobOrder) {
      return { success: false, error: "Job order not found." };
    }

    if (jobOrder.status !== "completed" && jobOrder.status !== "released") {
      return {
        success: false,
        error: `Job order ${jobOrder.job_order_number} must be completed before invoicing.`,
      };
    }

    const { data: existingInvoice, error: existingError } = await supabase
      .from("invoices")
      .select("id, invoice_number")
      .eq("job_order_id", parsed.data.job_order_id)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (existingError) {
      return { success: false, error: existingError.message };
    }

    if (existingInvoice) {
      return {
        success: false,
        error: `Invoice already exists for this job order (${existingInvoice.invoice_number}).`,
      };
    }

    const { count, error: countError } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("shop_id", shopId);

    if (countError) {
      return { success: false, error: countError.message };
    }

    const invoiceNumber = generateNumber("INV", count ?? 0);
    const { partsCost, totalAmount } = calculateTotals(
      parsed.data.labor_cost,
      parsed.data.items
    );
    const paymentCheck = validatePaymentDetails(
      parsed.data.payment_method,
      parsed.data.amount_paid,
      totalAmount,
      parsed.data.payment_reference,
      parsed.data.payer_account_name
    );
    if (!paymentCheck.ok) {
      return { success: false, error: paymentCheck.error };
    }
    const paymentStatus = calculatePaymentStatus(
      parsed.data.amount_paid,
      totalAmount
    );
    const amountPaid = normalizeInvoiceAmountPaid(
      parsed.data.amount_paid,
      totalAmount
    );
    const paymentDetails = normalizePaymentDetails(
      parsed.data.payment_method,
      parsed.data.amount_paid,
      totalAmount,
      parsed.data.payment_reference,
      parsed.data.payer_account_name
    );

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        shop_id: shopId,
        invoice_number: invoiceNumber,
        invoice_date: parsed.data.invoice_date,
        customer_id: parsed.data.customer_id,
        vehicle_id: parsed.data.vehicle_id,
        job_order_id: parsed.data.job_order_id || null,
        chassis_number: parsed.data.chassis_number || null,
        engine_number: parsed.data.engine_number || null,
        repair_description: parsed.data.repair_description || null,
        recommendation: parsed.data.recommendation || null,
        parts_used: parsed.data.parts_used || null,
        labor_cost: parsed.data.labor_cost,
        parts_cost: partsCost,
        total_amount: totalAmount,
        amount_paid: amountPaid,
        payment_method: (parsed.data.payment_method as PaymentMethod) || null,
        payment_reference: paymentDetails.payment_reference,
        payer_account_name: paymentDetails.payer_account_name,
        payment_status: paymentStatus,
        technician_name: parsed.data.technician_name || null,
      })
      .select()
      .single();

    if (invoiceError || !invoice) {
      return { success: false, error: invoiceError?.message ?? "Failed to create invoice" };
    }

    if (parsed.data.items.length > 0) {
      const invoiceItems = parsed.data.items.map((item) => ({
        shop_id: shopId,
        invoice_id: invoice.id,
        inventory_item_id: item.inventory_item_id || null,
        part_name: item.part_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(invoiceItems);

      if (itemsError) {
        await supabase.from("invoices").delete().eq("id", invoice.id);
        return { success: false, error: itemsError.message };
      }

      await deductInventoryForInvoice(
        supabase,
        shopId,
        invoice.id,
        parsed.data.items.map((item) => ({
          inventory_item_id: item.inventory_item_id || null,
          part_name: item.part_name,
          quantity: item.quantity,
        }))
      );
    }

    await syncSalesFromInvoice(supabase, shopId, {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      parts_cost: invoice.parts_cost,
      labor_cost: invoice.labor_cost,
      total_amount: invoice.total_amount,
      amount_paid: invoice.amount_paid,
      payment_status: invoice.payment_status,
    });

    const actor = await getActivityActor();
    if (actor) {
      await logActivity(supabase, {
        shopId: actor.shopId,
        userId: actor.userId,
        actorName: actor.actorName,
        actorRole: actor.actorRole,
        actionType: "invoice_created",
        entityType: "invoices",
        entityId: invoice.id,
        entityLabel: invoice.invoice_number,
        summary: `Created invoice ${invoice.invoice_number} for job order ${jobOrder.job_order_number}`,
        metadata: { job_order_number: jobOrder.job_order_number },
      });

      if (invoice.payment_status === "paid") {
        await logActivity(supabase, {
          shopId: actor.shopId,
          userId: actor.userId,
          actorName: actor.actorName,
          actorRole: actor.actorRole,
          actionType: "invoice_paid",
          entityType: "invoices",
          entityId: invoice.id,
          entityLabel: invoice.invoice_number,
          summary: `Marked invoice ${invoice.invoice_number} as paid`,
        });
      }
    }

    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard");
    return { success: true, data: invoice };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create invoice",
    };
  }
}

export async function updateInvoice(
  id: string,
  values: InvoiceFormValues
): Promise<ActionResult<InvoiceWithRelations>> {
  try {
    const parsed = invoiceFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getShopId();
    const supabase = await createClient();

    const { data: existingInvoice, error: existingError } = await supabase
      .from("invoices")
      .select(
        "labor_cost, job_order_id, customer_id, vehicle_id, invoice_date, chassis_number, engine_number, repair_description, recommendation, parts_used, technician_name"
      )
      .eq("id", id)
      .eq("shop_id", shopId)
      .single();

    if (existingError || !existingInvoice) {
      return { success: false, error: "Invoice not found" };
    }

    const updateCheck = await assertCanUpdateInvoice(supabase, shopId, id);
    if (!updateCheck.ok) {
      return { success: false, error: updateCheck.error };
    }

    const { data: existingItems, error: existingItemsError } = await supabase
      .from("invoice_items")
      .select("inventory_item_id, part_name, quantity, unit_price")
      .eq("invoice_id", id)
      .eq("shop_id", shopId);

    if (existingItemsError) {
      return { success: false, error: existingItemsError.message };
    }

    const laborChanged =
      Number(existingInvoice.labor_cost ?? 0) !== Number(parsed.data.labor_cost);
    const itemsChanged = !areInvoiceItemsEqual(
      existingItems ?? [],
      parsed.data.items
    );

    if (laborChanged || itemsChanged) {
      return {
        success: false,
        error:
          "Parts and labor cannot be changed on an invoice. Update the job order before invoicing.",
      };
    }

    if (
      existingInvoice.job_order_id &&
      hasJobOrderLinkedDetailChanges(existingInvoice, parsed.data)
    ) {
      return {
        success: false,
        error:
          "Job order details cannot be changed on an invoice. Update the job order first.",
      };
    }

    const { partsCost, totalAmount } = calculateTotals(
      parsed.data.labor_cost,
      parsed.data.items
    );
    const paymentCheck = validatePaymentDetails(
      parsed.data.payment_method,
      parsed.data.amount_paid,
      totalAmount,
      parsed.data.payment_reference,
      parsed.data.payer_account_name
    );
    if (!paymentCheck.ok) {
      return { success: false, error: paymentCheck.error };
    }
    const paymentStatus = calculatePaymentStatus(
      parsed.data.amount_paid,
      totalAmount
    );
    const amountPaid = normalizeInvoiceAmountPaid(
      parsed.data.amount_paid,
      totalAmount
    );
    const paymentDetails = normalizePaymentDetails(
      parsed.data.payment_method,
      parsed.data.amount_paid,
      totalAmount,
      parsed.data.payment_reference,
      parsed.data.payer_account_name
    );

    const { data, error } = await supabase
      .from("invoices")
      .update({
        invoice_date: parsed.data.invoice_date,
        customer_id: parsed.data.customer_id,
        vehicle_id: parsed.data.vehicle_id,
        job_order_id: parsed.data.job_order_id || null,
        chassis_number: parsed.data.chassis_number || null,
        engine_number: parsed.data.engine_number || null,
        repair_description: parsed.data.repair_description || null,
        recommendation: parsed.data.recommendation || null,
        parts_used: parsed.data.parts_used || null,
        labor_cost: parsed.data.labor_cost,
        parts_cost: partsCost,
        total_amount: totalAmount,
        amount_paid: amountPaid,
        payment_method: (parsed.data.payment_method as PaymentMethod) || null,
        payment_reference: paymentDetails.payment_reference,
        payer_account_name: paymentDetails.payer_account_name,
        payment_status: paymentStatus,
        technician_name: parsed.data.technician_name || null,
      })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await supabase.from("invoice_items").delete().eq("invoice_id", id);

    if (parsed.data.items.length > 0) {
      const invoiceItems = parsed.data.items.map((item) => ({
        shop_id: shopId,
        invoice_id: id,
        inventory_item_id: item.inventory_item_id || null,
        part_name: item.part_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(invoiceItems);

      if (itemsError) {
        return { success: false, error: itemsError.message };
      }
    }

    await syncSalesFromInvoice(supabase, shopId, {
      id: data.id,
      invoice_number: data.invoice_number,
      invoice_date: data.invoice_date,
      parts_cost: data.parts_cost,
      labor_cost: data.labor_cost,
      total_amount: data.total_amount,
      amount_paid: data.amount_paid,
      payment_status: data.payment_status,
    });

    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${id}`);
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard");
    if (data.job_order_id) {
      revalidatePath(`/dashboard/job-orders/${data.job_order_id}`);
    }

    const refreshed = await getInvoice(id);
    if (!refreshed.success) {
      return { success: false, error: refreshed.error };
    }

    return { success: true, data: refreshed.data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update invoice",
    };
  }
}

export async function deleteInvoice(id: string): Promise<ActionResult> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const deleteCheck = await assertCanDeleteInvoice(supabase, shopId, id);
    if (!deleteCheck.ok) {
      return { success: false, error: deleteCheck.error };
    }

    const { data: invoiceToDelete, error: fetchError } = await supabase
      .from("invoices")
      .select("job_order_id")
      .eq("id", id)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    await supabase
      .from("sales_records")
      .delete()
      .eq("shop_id", shopId)
      .eq("invoice_id", id);

    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/job-orders");
    revalidatePath("/dashboard");
    if (invoiceToDelete?.job_order_id) {
      revalidatePath(`/dashboard/job-orders/${invoiceToDelete.job_order_id}`);
    }
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete invoice",
    };
  }
}

export async function updatePayment(
  id: string,
  values: PaymentUpdateValues
): Promise<ActionResult<InvoiceWithRelations>> {
  try {
    const parsed = paymentUpdateSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const shopId = await getShopId();
    const supabase = await createClient();

    const { data: existing, error: fetchError } = await supabase
      .from("invoices")
      .select("total_amount, payment_status, invoice_number")
      .eq("id", id)
      .eq("shop_id", shopId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Invoice not found" };
    }

    const updateCheck = await assertCanUpdateInvoice(supabase, shopId, id);
    if (!updateCheck.ok) {
      return { success: false, error: updateCheck.error };
    }

    const paymentCheck = validatePaymentDetails(
      parsed.data.payment_method,
      parsed.data.amount_paid,
      existing.total_amount,
      parsed.data.payment_reference,
      parsed.data.payer_account_name
    );
    if (!paymentCheck.ok) {
      return { success: false, error: paymentCheck.error };
    }

    const paymentStatus = calculatePaymentStatus(
      parsed.data.amount_paid,
      existing.total_amount
    );
    const amountPaid = normalizeInvoiceAmountPaid(
      parsed.data.amount_paid,
      existing.total_amount
    );
    const paymentDetails = normalizePaymentDetails(
      parsed.data.payment_method,
      parsed.data.amount_paid,
      existing.total_amount,
      parsed.data.payment_reference,
      parsed.data.payer_account_name
    );

    const { data, error } = await supabase
      .from("invoices")
      .update({
        amount_paid: amountPaid,
        payment_method: (parsed.data.payment_method as PaymentMethod) || null,
        payment_reference: paymentDetails.payment_reference,
        payer_account_name: paymentDetails.payer_account_name,
        payment_status: paymentStatus,
      })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (
      paymentStatus === "paid" &&
      existing.payment_status !== "paid"
    ) {
      const actor = await getActivityActor();
      if (actor) {
        await logActivity(supabase, {
          shopId: actor.shopId,
          userId: actor.userId,
          actorName: actor.actorName,
          actorRole: actor.actorRole,
          actionType: "invoice_paid",
          entityType: "invoices",
          entityId: data.id,
          entityLabel: existing.invoice_number,
          summary: `Marked invoice ${existing.invoice_number} as paid`,
        });
      }
    }

    await syncSalesFromInvoice(supabase, shopId, {
      id: data.id,
      invoice_number: data.invoice_number,
      invoice_date: data.invoice_date,
      parts_cost: data.parts_cost,
      labor_cost: data.labor_cost,
      total_amount: data.total_amount,
      amount_paid: data.amount_paid,
      payment_status: data.payment_status,
    });

    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${id}`);
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/reports");
    if (data.job_order_id) {
      revalidatePath(`/dashboard/job-orders/${data.job_order_id}`);
    }

    const refreshed = await getInvoice(id);
    if (!refreshed.success) {
      return { success: false, error: refreshed.error };
    }

    return { success: true, data: refreshed.data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update payment",
    };
  }
}

const JOB_ORDER_INVOICE_SELECT =
  "*, job_order_parts(*), repair_estimates(*), vehicles(chassis_number, engine_number)";

type JobOrderForInvoice = {
  customer_id: string;
  vehicle_id: string;
  assigned_technician: string | null;
  repair_description: string | null;
  labor_cost?: number;
  job_order_parts?: {
    inventory_item_id: string | null;
    part_name: string;
    quantity: number;
    unit_price: number;
  }[];
  repair_estimates?: {
    labor_cost?: number;
    chassis_number?: string | null;
    engine_number?: string | null;
    repair_description?: string | null;
    recommendation?: string | null;
    technician_name?: string | null;
  } | null;
  vehicles?: {
    chassis_number: string | null;
    engine_number: string | null;
  } | null;
};

function buildInvoiceFormValuesFromJobOrder(
  jobOrderId: string,
  jobOrder: JobOrderForInvoice
): InvoiceFormValues {
  const estimate = jobOrder.repair_estimates;
  const parts = jobOrder.job_order_parts ?? [];
  const vehicle = jobOrder.vehicles;

  return {
    customer_id: jobOrder.customer_id,
    vehicle_id: jobOrder.vehicle_id,
    job_order_id: jobOrderId,
    invoice_date: new Date().toISOString().split("T")[0],
    chassis_number:
      estimate?.chassis_number ?? vehicle?.chassis_number ?? "",
    engine_number: estimate?.engine_number ?? vehicle?.engine_number ?? "",
    repair_description:
      jobOrder.repair_description ?? estimate?.repair_description ?? "",
    recommendation: estimate?.recommendation ?? "",
    parts_used: parts.map((part) => part.part_name).join(", "),
    labor_cost: jobOrder.labor_cost ?? estimate?.labor_cost ?? 0,
    technician_name:
      jobOrder.assigned_technician ?? estimate?.technician_name ?? "",
    amount_paid: 0,
    payment_method: "",
    payment_reference: "",
    payer_account_name: "",
    items: parts.map((part) => ({
      inventory_item_id: part.inventory_item_id ?? "",
      part_name: part.part_name,
      quantity: part.quantity,
      unit_price: part.unit_price,
    })),
  };
}

export async function getJobOrderInvoicePrefill(
  jobOrderId: string
): Promise<ActionResult<InvoiceFormValues>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data: jobOrder, error: jobError } = await supabase
      .from("job_orders")
      .select(JOB_ORDER_INVOICE_SELECT)
      .eq("id", jobOrderId)
      .eq("shop_id", shopId)
      .single();

    if (jobError || !jobOrder) {
      return { success: false, error: "Job order not found" };
    }

    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id")
      .eq("job_order_id", jobOrderId)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (existingInvoice) {
      return {
        success: false,
        error: "Invoice already exists for this job order",
      };
    }

    return {
      success: true,
      data: buildInvoiceFormValuesFromJobOrder(
        jobOrderId,
        jobOrder as JobOrderForInvoice
      ),
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to load job order for invoice",
    };
  }
}

export async function generateFromJobOrder(
  jobOrderId: string
): Promise<ActionResult<Invoice>> {
  try {
    const prefill = await getJobOrderInvoicePrefill(jobOrderId);
    if (!prefill.success) {
      return prefill;
    }

    return createInvoice(prefill.data);
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to generate invoice from job order",
    };
  }
}

export async function getVehiclesForSelect(
  customerId?: string
): Promise<ActionResult<Pick<Vehicle, "id" | "plate_number" | "brand" | "model" | "customer_id">[]>> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    let query = supabase
      .from("vehicles")
      .select("id, plate_number, brand, model, customer_id")
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .order("plate_number");

    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    const { data, error } = await query;

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
      import("@/types/database").InventoryItem,
      "id" | "part_number" | "part_name" | "selling_price" | "quantity"
    >[]
  >
> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("inventory_items")
      .select("id, part_number, part_name, selling_price, quantity")
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

export async function getJobOrdersForSelect(): Promise<
  ActionResult<
    Pick<JobOrder, "id" | "job_order_number" | "status" | "customer_id" | "vehicle_id">[]
  >
> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const [{ data, error }, { data: invoicedRows, error: invoicedError }] =
      await Promise.all([
        supabase
          .from("job_orders")
          .select("id, job_order_number, status, customer_id, vehicle_id")
          .eq("shop_id", shopId)
          .in("status", ["completed", "released"])
          .order("created_at", { ascending: false }),
        supabase
          .from("invoices")
          .select("job_order_id")
          .eq("shop_id", shopId)
          .not("job_order_id", "is", null),
      ]);

    if (error) {
      return { success: false, error: error.message };
    }

    if (invoicedError) {
      return { success: false, error: invoicedError.message };
    }

    const invoicedIds = new Set(
      (invoicedRows ?? [])
        .map((row) => row.job_order_id)
        .filter((id): id is string => !!id)
    );

    const available = (data ?? []).filter((jobOrder) => !invoicedIds.has(jobOrder.id));

    return { success: true, data: available };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch job orders",
    };
  }
}
