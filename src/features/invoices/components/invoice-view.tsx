"use client";

import { useEffect, useRef, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";
import { APP_NAME, PAYMENT_METHODS } from "@/lib/constants";
import { downloadPDF, generateInvoicePDF } from "@/lib/pdf/generator";
import { useInvalidateDashboard } from "@/lib/hooks/use-invalidate-dashboard";
import { useShop } from "@/lib/hooks/use-shop";
import { formatCurrency, formatDate, formatQuantity } from "@/lib/utils";
import {
  getInvoicePaymentSummary,
  requiresPaymentReference,
  validatePaymentDetails,
} from "@/lib/invoices/payment";
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
  const [isPaid, setIsPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [paymentReference, setPaymentReference] = useState("");
  const [payerAccountName, setPayerAccountName] = useState("");

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: async () => {
      const result = await getInvoice(invoiceId);
      if (!result.success) throw new Error(result.error);

      if (result.data.verification_code) {
        const url = `${process.env.NEXT_PUBLIC_APP_URL}/verify/${result.data.verification_code}`;
        QRCode.toDataURL(url, { width: 120 }).then(setQrDataUrl).catch(() => {});
      }

      return result.data;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!invoice) return;
    setIsPaid(invoice.payment_status === "paid");
    setPaymentMethod(invoice.payment_method ?? "");
    setPaymentReference(invoice.payment_reference ?? "");
    setPayerAccountName(invoice.payer_account_name ?? "");
  }, [invoice]);

  const showPaymentReference = isPaid && requiresPaymentReference(paymentMethod);

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const amountPaid = isPaid ? invoice!.total_amount : 0;
      const paymentCheck = validatePaymentDetails(
        paymentMethod,
        amountPaid,
        invoice!.total_amount,
        paymentReference,
        payerAccountName
      );
      if (!paymentCheck.ok) {
        throw new Error(paymentCheck.error);
      }

      const result = await updatePayment(invoiceId, {
        amount_paid: amountPaid,
        payment_method: paymentMethod || undefined,
        payment_reference: paymentReference,
        payer_account_name: payerAccountName,
      });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (updatedInvoice) => {
      queryClient.setQueryData(["invoice", invoiceId], updatedInvoice);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId, "edit"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      if (updatedInvoice.job_order_id) {
        queryClient.invalidateQueries({
          queryKey: ["job-order", updatedInvoice.job_order_id],
        });
        queryClient.invalidateQueries({
          queryKey: ["job-order-linked-invoice", updatedInvoice.job_order_id],
        });
      }
      invalidateDashboard();
      toast.success(
        updatedInvoice.payment_status === "paid"
          ? "Invoice marked as paid"
          : "Payment cleared"
      );
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

  const paymentSummary = getInvoicePaymentSummary(
    invoice.amount_paid,
    invoice.total_amount
  );

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
          updated or deleted.
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
              {invoice.payment_method && (
                <div>
                  <p className="text-sm text-muted-foreground">Payment Method</p>
                  <p className="font-medium capitalize">
                    {invoice.payment_method.replace(/_/g, " ")}
                  </p>
                </div>
              )}
              {invoice.payment_reference && (
                <div>
                  <p className="text-sm text-muted-foreground">Reference Number</p>
                  <p className="font-medium">{invoice.payment_reference}</p>
                </div>
              )}
              {invoice.payer_account_name && (
                <div>
                  <p className="text-sm text-muted-foreground">Payer Account Name</p>
                  <p className="font-medium">{invoice.payer_account_name}</p>
                </div>
              )}
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
                      <TableCell className="text-right">{formatQuantity(item.quantity)}</TableCell>
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
                  <span>{formatCurrency(paymentSummary.appliedPaid)}</span>
                </div>
                {paymentSummary.change > 0 && (
                  <div className="flex justify-between text-sm text-emerald-700 dark:text-emerald-400">
                    <span>Change</span>
                    <span>{formatCurrency(paymentSummary.change)}</span>
                  </div>
                )}
                {invoice.payment_status !== "paid" && paymentSummary.balance > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Balance</span>
                    <span>{formatCurrency(paymentSummary.balance)}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Update Payment</CardTitle>
          <CardDescription>
            {invoice.job_orders?.status === "released"
              ? "Payment cannot be changed because the linked job order is already released."
              : "Record payment received for this invoice."}
          </CardDescription>
        </CardHeader>
        <CardContent
          className={`space-y-4 ${invoice.job_orders?.status === "released" ? "pointer-events-none opacity-60" : ""}`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label>Payment</Label>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{isPaid ? "Paid" : "Unpaid"}</p>
                  <p className="text-xs text-muted-foreground">
                    {invoice.total_amount <= 0
                      ? "Invoice total is zero"
                      : isPaid
                        ? `Full amount: ${formatCurrency(invoice.total_amount)}`
                        : "Toggle on to mark as fully paid"}
                  </p>
                </div>
                <Switch
                  checked={isPaid}
                  disabled={invoice.total_amount <= 0}
                  onCheckedChange={(checked) => {
                    setIsPaid(checked);
                    if (!checked) {
                      setPaymentMethod("");
                      setPaymentReference("");
                      setPayerAccountName("");
                    }
                  }}
                />
              </div>
            </div>
            {isPaid && (
              <div className="flex-1 space-y-2">
                <Label>Payment Method *</Label>
                <Select
                  value={paymentMethod || undefined}
                  onValueChange={(v) => {
                    setPaymentMethod(v as PaymentMethod);
                    if (v === "cash") {
                      setPaymentReference("");
                      setPayerAccountName("");
                    }
                  }}
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
            )}
            <Button
              onClick={() => paymentMutation.mutate()}
              disabled={
                paymentMutation.isPending || invoice.job_orders?.status === "released"
              }
            >
              {paymentMutation.isPending ? "Saving..." : "Save Payment"}
            </Button>
          </div>
          {showPaymentReference && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="payment_reference">Reference Number *</Label>
                <Input
                  id="payment_reference"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Transaction / reference number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payer_account_name">Payer Account Name *</Label>
                <Input
                  id="payer_account_name"
                  value={payerAccountName}
                  onChange={(e) => setPayerAccountName(e.target.value)}
                  placeholder="Name on the account used to pay"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
