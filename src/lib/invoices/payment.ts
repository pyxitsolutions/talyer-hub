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
