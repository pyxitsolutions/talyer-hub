import type { Metadata } from "next";
import { AlertCircle, BadgeCheck, Car, User } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { ShopLogo } from "@/components/shared/shop-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { APP_NAME } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getInvoicePaymentSummary } from "@/lib/invoices/payment";
import { getPublicInvoiceVerification } from "@/features/invoices/verify-actions";

interface VerifyPageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Invoice Verification | ${APP_NAME}`,
    description: "Verify the authenticity of a billing invoice.",
    robots: { index: false, follow: false },
  };
}

function VerifyErrorCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

export default async function VerifyInvoicePage({ params }: VerifyPageProps) {
  const { code } = await params;
  const result = await getPublicInvoiceVerification(code);

  if (!result.success) {
    if (result.error === "config_error") {
      return (
        <VerifyErrorCard
          title="Verification unavailable"
          description="Invoice verification is temporarily unavailable. Please contact the shop directly."
        />
      );
    }

    return (
      <VerifyErrorCard
        title="Invoice not found"
        description="This verification link is invalid or the invoice is no longer in our system."
      />
    );
  }

  const invoice = result.data;
  const paymentSummary = getInvoicePaymentSummary(
    invoice.amount_paid,
    invoice.total_amount
  );

  return (
    <Card>
      <CardHeader className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <BadgeCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <CardTitle className="text-2xl">Verified Invoice</CardTitle>
          <CardDescription>
            This billing invoice is registered in {invoice.shop.shop_name}&apos;s
            system.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <ShopLogo
              logoUrl={invoice.shop.logo_url}
              alt={invoice.shop.shop_name}
              size="md"
            />
            <div>
              <p className="font-semibold">{invoice.shop.shop_name}</p>
              {invoice.shop.address && (
                <p className="text-sm text-muted-foreground">
                  {invoice.shop.address}
                </p>
              )}
              {(invoice.shop.contact_number || invoice.shop.email) && (
                <p className="text-sm text-muted-foreground">
                  {[invoice.shop.contact_number, invoice.shop.email]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Invoice Number
            </p>
            <p className="font-medium">{invoice.invoice_number}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Invoice Date
            </p>
            <p className="font-medium">{formatDate(invoice.invoice_date)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Payment Status
            </p>
            <div className="mt-1">
              <StatusBadge status={invoice.payment_status} />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Verified On
            </p>
            <p className="font-medium">{formatDate(new Date().toISOString())}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="font-medium">{invoice.customer_name}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Car className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Vehicle</p>
              <p className="font-medium">
                {invoice.vehicle.plate_number} — {invoice.vehicle.brand}{" "}
                {invoice.vehicle.model}
              </p>
            </div>
          </div>
        </div>

        {invoice.repair_description && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Repair Description
            </p>
            <p className="mt-1 text-sm">{invoice.repair_description}</p>
          </div>
        )}

        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Labor</span>
              <span>{formatCurrency(invoice.labor_cost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Parts</span>
              <span>{formatCurrency(invoice.parts_cost)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span>{formatCurrency(invoice.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount Received</span>
              <span>{formatCurrency(invoice.amount_paid)}</span>
            </div>
            {paymentSummary.change > 0 && (
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>Change</span>
                <span>{formatCurrency(paymentSummary.change)}</span>
              </div>
            )}
            {paymentSummary.balance > 0 && (
              <div className="flex justify-between text-amber-700 dark:text-amber-400">
                <span>Balance</span>
                <span>{formatCurrency(paymentSummary.balance)}</span>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Scan-to-verify confirms this invoice exists in the shop&apos;s official
          records. For questions, contact the shop directly.
        </p>
      </CardContent>
    </Card>
  );
}
