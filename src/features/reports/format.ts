import { formatCurrency, formatCurrencyForPDF } from "@/lib/utils";

const COUNT_SUMMARY_KEYS = [
  "total units",
  "total invoices",
  "total job orders",
  "record count",
  "fully paid",
];

export function isCurrencySummaryKey(key: string): boolean {
  const normalized = key.toLowerCase();

  if (normalized.includes("margin")) {
    return false;
  }

  if (COUNT_SUMMARY_KEYS.some((countKey) => normalized.includes(countKey))) {
    return false;
  }

  return (
    normalized.includes("sales") ||
    normalized.includes("expenses") ||
    normalized.includes("profit") ||
    normalized.includes("billed") ||
    normalized.includes("collected") ||
    normalized.includes("parts") ||
    normalized.includes("materials") ||
    normalized.includes("labor") ||
    normalized.includes("amount")
  );
}

export function formatReportSummaryValue(
  key: string,
  value: string | number,
  options?: { forPdf?: boolean }
): string {
  if (typeof value !== "number") {
    return value;
  }

  if (key.toLowerCase().includes("margin")) {
    return `${value}%`;
  }

  if (isCurrencySummaryKey(key)) {
    return options?.forPdf ? formatCurrencyForPDF(value) : formatCurrency(value);
  }

  return String(value);
}

export function isCurrencyColumnKey(key: string): boolean {
  const normalized = key.toLowerCase();

  if (normalized === "total" || normalized === "paid") {
    return true;
  }

  return (
    normalized.includes("amount") ||
    normalized.includes("sales") ||
    normalized.includes("expenses") ||
    normalized.includes("profit") ||
    normalized.includes("billed") ||
    normalized.includes("collected")
  );
}
