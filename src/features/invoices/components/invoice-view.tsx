"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Printer } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { ShopLogo } from "@/components/shared/shop-logo";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { APP_NAME, PAYMENT_METHODS } from "@/lib/constants";
import { downloadPDF, generateInvoicePDF } from "@/lib/pdf/generator";
import { useInvalidateDashboard } from "@/lib/hooks/use-invalidate-dashboard";
import { useShop } from "@/lib/hooks/use-shop";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PaymentMethod } from "@/types/database";
import { getInvoice, updatePayment } from "../actions";

interface InvoiceViewProps {
  invoiceId: string;
}

export function InvoiceView({ invoiceId }: InvoiceViewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const invalidateDashboard = useInvalidateDashboard();
  const { shop } = useShop();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: async () => {
      const result = await getInvoice(invoiceId);
      if (!result.success) throw new Error(result.error);
      setAmountPaid(String(result.data.amount_paid));
      setPaymentMethod(result.data.payment_method ?? "");

      if (result.data.verification_code) {
        const url = `${process.env.NEXT_PUBLIC_APP_URL}/verify/${result.data.verification_code}`;
        QRCode.toDataURL(url, { width: 120 }).then(setQrDataUrl).catch(() => {});
      }

      return result.data;
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const result = await updatePayment(invoiceId, {
        amount_paid: parseFloat(amountPaid) || 0,
        payment_method: paymentMethod || undefined,
      });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      invalidateDashboard();
      toast.success("Payment updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!shop || !invoice) return;
    try {
      const doc = await generateInvoicePDF(shop, invoice);
      downloadPDF(doc, `${invoice.invoice_number}.pdf`);
    } catch {
      toast.error("Failed to generate PDF");
    }
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Loading invoice...</p>;
  }

  if (!invoice) {
    return <p className="text-destructive">Invoice not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/invoices">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader
          title={`Invoice ${invoice.invoice_number}`}
          description={`Issued on ${formatDate(invoice.invoice_date)}`}
        />
      </div>

      {invoice.job_orders?.status === "released" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive print:hidden">
          <strong>Locked record.</strong> Job order{" "}
          {invoice.job_orders.job_order_number} is released. This invoice cannot be
          deleted.
        </div>
      )}

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
        <Button variant="outline" onClick={handleDownloadPDF}>
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
      </div>

      <div ref={printRef} className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <ShopLogo
                logoUrl={shop?.logo_url}
                alt={shop?.shop_name ?? APP_NAME}
                size="lg"
              />
              <div>
                <CardTitle className="text-2xl">Billing Invoice</CardTitle>
                <CardDescription>
                  {shop?.shop_name ?? APP_NAME}
                </CardDescription>
              </div>
            </div>
            {qrDataUrl && (
              <div className="text-center">
                <img src={qrDataUrl} alt="Verification QR" className="mx-auto h-24 w-24" />
                <p className="mt-1 text-xs text-muted-foreground">Scan to verify</p>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Invoice Number</p>
                <p className="font-medium">{invoice.invoice_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">{formatDate(invoice.invoice_date)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="font-medium">{invoice.customers?.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vehicle</p>
                <p className="font-medium">
                  {invoice.vehicles?.brand} {invoice.vehicles?.model} ({invoice.vehicles?.plate_number})
                </p>
              </div>
              {invoice.technician_name && (
                <div>
                  <p className="text-sm text-muted-foreground">Technician</p>
                  <p className="font-medium">{invoice.technician_name}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Payment Status</p>
                <StatusBadge status={invoice.payment_status} />
              </div>
            </div>

            {invoice.repair_description && (
              <div>
                <p className="text-sm text-muted-foreground">Repair Description</p>
                <p className="text-sm">{invoice.repair_description}</p>
              </div>
            )}

            {invoice.invoice_items && invoice.invoice_items.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part/Service</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.invoice_items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.part_name}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unit_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.total_price)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Labor</span>
                  <span>{formatCurrency(invoice.labor_cost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Parts</span>
                  <span>{formatCurrency(invoice.parts_cost)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.total_amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Paid</span>
                  <span>{formatCurrency(invoice.amount_paid)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Balance</span>
                  <span>
                    {formatCurrency(invoice.total_amount - invoice.amount_paid)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Update Payment</CardTitle>
          <CardDescription>Record payment received for this invoice.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="amount_paid">Amount Paid</Label>
            <Input
              id="amount_paid"
              type="number"
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
            />
          </div>
          <div className="flex-1 space-y-2">
            <Label>Payment Method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => paymentMutation.mutate()}
            disabled={paymentMutation.isPending}
          >
            {paymentMutation.isPending ? "Saving..." : "Update Payment"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
