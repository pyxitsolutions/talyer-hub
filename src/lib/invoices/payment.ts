import type { PaymentMethod } from "@/types/database";

/** Amount applied to the invoice (capped at total — overpayment is change, not credit). */
export function normalizeInvoiceAmountPaid(
  amountPaid: number,
  totalAmount: number
): number {
  const paid = Math.max(0, amountPaid);
  if (totalAmount <= 0) {
    return paid;
  }
  return Math.min(paid, totalAmount);
}

export function validateFullPaymentOnly(
  amountPaid: number,
  totalAmount: number
): { ok: true } | { ok: false; error: string } {
  const paid = Math.max(0, amountPaid);
  if (paid <= 0 || totalAmount <= 0) {
    return { ok: true };
  }

  if (paid < totalAmount) {
    return {
      ok: false,
      error: "Full payment only. Enter the full invoice amount or leave payment at zero.",
    };
  }

  return { ok: true };
}

export function requiresPaymentReference(
  method: PaymentMethod | "" | null | undefined
): boolean {
  return !!method && method !== "cash";
}

export function normalizePaymentDetails(
  paymentMethod: PaymentMethod | "" | null | undefined,
  amountPaid: number,
  totalAmount: number,
  paymentReference?: string | null,
  payerAccountName?: string | null
): {
  payment_reference: string | null;
  payer_account_name: string | null;
} {
  const paid = normalizeInvoiceAmountPaid(amountPaid, totalAmount);
  const isPaid = totalAmount > 0 && paid >= totalAmount;

  if (!isPaid || !requiresPaymentReference(paymentMethod)) {
    return { payment_reference: null, payer_account_name: null };
  }

  return {
    payment_reference: (paymentReference ?? "").trim() || null,
    payer_account_name: (payerAccountName ?? "").trim() || null,
  };
}

export function validatePaymentDetails(
  paymentMethod: PaymentMethod | "" | null | undefined,
  amountPaid: number,
  totalAmount: number,
  paymentReference?: string | null,
  payerAccountName?: string | null
): { ok: true } | { ok: false; error: string } {
  const fullPaymentCheck = validateFullPaymentOnly(amountPaid, totalAmount);
  if (!fullPaymentCheck.ok) {
    return fullPaymentCheck;
  }

  const paid = normalizeInvoiceAmountPaid(amountPaid, totalAmount);
  const isPaid = totalAmount > 0 && paid >= totalAmount;

  if (isPaid && !paymentMethod) {
    return { ok: false, error: "Select a payment method for paid invoices." };
  }

  if (isPaid && requiresPaymentReference(paymentMethod)) {
    if (!(paymentReference ?? "").trim()) {
      return {
        ok: false,
        error: "Reference number is required for non-cash payments.",
      };
    }
    if (!(payerAccountName ?? "").trim()) {
      return {
        ok: false,
        error: "Payer account name is required for non-cash payments.",
      };
    }
  }

  return { ok: true };
}

export function getInvoicePaymentSummary(
  amountPaid: number,
  totalAmount: number
) {
  const appliedPaid = normalizeInvoiceAmountPaid(amountPaid, totalAmount);
  return {
    appliedPaid,
    balance: Math.max(0, totalAmount - appliedPaid),
    change: Math.max(0, amountPaid - totalAmount),
  };
}
