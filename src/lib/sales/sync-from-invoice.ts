import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentStatus } from "@/types/database";

interface InvoiceForSalesSync {
  id: string;
  invoice_number: string;
  invoice_date: string;
  parts_cost: number;
  labor_cost: number;
  total_amount: number;
  amount_paid: number;
  payment_status: PaymentStatus;
}

export async function syncSalesFromInvoice(
  supabase: SupabaseClient,
  shopId: string,
  invoice: InvoiceForSalesSync
) {
  await supabase
    .from("sales_records")
    .delete()
    .eq("shop_id", shopId)
    .eq("invoice_id", invoice.id);

  if (invoice.amount_paid <= 0 || invoice.payment_status === "unpaid") {
    return;
  }

  const ratio =
    invoice.total_amount > 0 ? invoice.amount_paid / invoice.total_amount : 1;

  const partsAmount = Math.round(invoice.parts_cost * ratio * 100) / 100;
  const laborAmount = Math.round(invoice.labor_cost * ratio * 100) / 100;

  const records: {
    shop_id: string;
    sale_date: string;
    sale_type: "parts" | "labor";
    description: string;
    amount: number;
    invoice_id: string;
  }[] = [];

  if (partsAmount > 0) {
    records.push({
      shop_id: shopId,
      sale_date: invoice.invoice_date,
      sale_type: "parts",
      description: `Parts - ${invoice.invoice_number}`,
      amount: partsAmount,
      invoice_id: invoice.id,
    });
  }

  if (laborAmount > 0) {
    records.push({
      shop_id: shopId,
      sale_date: invoice.invoice_date,
      sale_type: "labor",
      description: `Labor - ${invoice.invoice_number}`,
      amount: laborAmount,
      invoice_id: invoice.id,
    });
  }

  if (records.length > 0) {
    const { error } = await supabase.from("sales_records").insert(records);
    if (error) {
      console.error("Failed to sync sales from invoice:", error.message);
    }
  }
}

export async function syncAllPaidInvoicesToSales(
  supabase: SupabaseClient,
  shopId: string
) {
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, invoice_date, parts_cost, labor_cost, total_amount, amount_paid, payment_status"
    )
    .eq("shop_id", shopId)
    .gt("amount_paid", 0);

  if (error) {
    console.error("Failed to load invoices for sales sync:", error.message);
    return;
  }

  for (const invoice of invoices ?? []) {
    await syncSalesFromInvoice(supabase, shopId, invoice as InvoiceForSalesSync);
  }
}
