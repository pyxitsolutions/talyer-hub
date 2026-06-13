import type { ReactNode } from "react";

import { ShopLogo } from "@/components/shared/shop-logo";
import { APP_NAME } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { Shop } from "@/types/database";

interface PrintDocumentLayoutProps {
  shop?: Pick<
    Shop,
    "shop_name" | "address" | "contact_number" | "email" | "logo_url"
  > | null;
  title: string;
  documentNumber: string;
  date: string;
  children: ReactNode;
}

export function PrintDocumentLayout({
  shop,
  title,
  documentNumber,
  date,
  children,
}: PrintDocumentLayoutProps) {
  return (
    <article className="hidden print:block text-black">
      <header className="mb-6 border-b-2 border-black pb-4">
        <div className="flex items-start gap-4">
          <ShopLogo
            logoUrl={shop?.logo_url}
            alt={shop?.shop_name ?? APP_NAME}
            size="lg"
            className="print:h-16 print:w-16"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight">
              {shop?.shop_name ?? APP_NAME}
            </h1>
            {shop?.address && (
              <p className="mt-1 text-sm leading-snug">{shop.address}</p>
            )}
            <p className="mt-1 text-sm">
              Tel: {shop?.contact_number || "N/A"} | Email:{" "}
              {shop?.email || "N/A"}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <h2 className="text-base font-bold uppercase tracking-wide">{title}</h2>
          <p className="mt-1 text-sm">No: {documentNumber}</p>
          <p className="text-sm">Date: {formatDate(date)}</p>
        </div>
      </header>

      <div className="space-y-5 text-sm leading-relaxed">{children}</div>

      <footer className="mt-16 grid grid-cols-2 gap-16 text-sm">
        <div>
          <div className="border-t border-black pt-1">Customer Signature</div>
        </div>
        <div>
          <div className="border-t border-black pt-1">Authorized Signature</div>
        </div>
      </footer>
    </article>
  );
}

interface PrintFieldProps {
  label: string;
  value: ReactNode;
}

export function PrintField({ label, value }: PrintFieldProps) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
        {label}
      </p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

interface PrintSectionProps {
  title: string;
  children: ReactNode;
}

export function PrintSection({ title, children }: PrintSectionProps) {
  return (
    <section>
      <h3 className="mb-2 border-b border-neutral-400 pb-1 text-sm font-semibold uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </section>
  );
}

interface PrintLineItemsTableProps {
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, ReactNode>[];
  emptyMessage?: string;
}

export function PrintLineItemsTable({
  columns,
  rows,
  emptyMessage = "No items.",
}: PrintLineItemsTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-600">{emptyMessage}</p>;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b-2 border-black">
          {columns.map((column) => (
            <th
              key={column.key}
              className={`py-2 font-semibold ${
                column.align === "right" ? "text-right" : "text-left"
              }`}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} className="border-b border-neutral-300">
            {columns.map((column) => (
              <td
                key={column.key}
                className={`py-2 ${
                  column.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {row[column.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface PrintTotalsProps {
  items: { label: string; value: ReactNode; emphasis?: boolean }[];
}

export function PrintTotals({ items }: PrintTotalsProps) {
  return (
    <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
      {items.map((item) => (
        <div
          key={item.label}
          className={`flex justify-between gap-4 ${
            item.emphasis ? "border-t border-black pt-2 text-base font-bold" : ""
          }`}
        >
          <span>{item.label}</span>
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
