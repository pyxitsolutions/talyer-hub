"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentStatus } from "@/types/database";

const VERIFICATION_CODE_PATTERN = /^[a-f0-9]{32}$/i;

export interface PublicInvoiceVerification {
  invoice_number: string;
  invoice_date: string;
  payment_status: PaymentStatus;
  total_amount: number;
  amount_paid: number;
  labor_cost: number;
  parts_cost: number;
  repair_description: string | null;
  shop: {
    shop_name: string;
    address: string | null;
    contact_number: string | null;
    email: string | null;
    logo_url: string | null;
  };
  customer_name: string;
  vehicle: {
    plate_number: string;
    brand: string;
    model: string;
  };
}

export type VerifyInvoiceResult =
  | { success: true; data: PublicInvoiceVerification }
  | { success: false; error: "invalid_code" | "not_found" | "config_error" };

export async function getPublicInvoiceVerification(
  code: string
): Promise<VerifyInvoiceResult> {
  if (!VERIFICATION_CODE_PATTERN.test(code)) {
    return { success: false, error: "invalid_code" };
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return { success: false, error: "config_error" };
  }

  const { data, error } = await supabase
    .from("invoices")
    .select(
      `
      invoice_number,
      invoice_date,
      payment_status,
      total_amount,
      amount_paid,
      labor_cost,
      parts_cost,
      repair_description,
      customers(full_name),
      vehicles(plate_number, brand, model),
      shops(shop_name, address, contact_number, email, logo_url)
    `
    )
    .eq("verification_code", code)
    .maybeSingle();

  if (error || !data) {
    return { success: false, error: "not_found" };
  }

  const customerRaw = data.customers as
    | { full_name: string }
    | { full_name: string }[]
    | null;
  const vehicleRaw = data.vehicles as
    | { plate_number: string; brand: string; model: string }
    | { plate_number: string; brand: string; model: string }[]
    | null;
  const shopRaw = data.shops as
    | {
        shop_name: string;
        address: string | null;
        contact_number: string | null;
        email: string | null;
        logo_url: string | null;
      }
    | {
        shop_name: string;
        address: string | null;
        contact_number: string | null;
        email: string | null;
        logo_url: string | null;
      }[]
    | null;

  const customer = Array.isArray(customerRaw) ? customerRaw[0] : customerRaw;
  const vehicle = Array.isArray(vehicleRaw) ? vehicleRaw[0] : vehicleRaw;
  const shop = Array.isArray(shopRaw) ? shopRaw[0] : shopRaw;

  if (!shop || !customer || !vehicle) {
    return { success: false, error: "not_found" };
  }

  return {
    success: true,
    data: {
      invoice_number: data.invoice_number,
      invoice_date: data.invoice_date,
      payment_status: data.payment_status as PaymentStatus,
      total_amount: data.total_amount,
      amount_paid: data.amount_paid,
      labor_cost: data.labor_cost,
      parts_cost: data.parts_cost,
      repair_description: data.repair_description,
      shop,
      customer_name: customer.full_name,
      vehicle,
    },
  };
}
