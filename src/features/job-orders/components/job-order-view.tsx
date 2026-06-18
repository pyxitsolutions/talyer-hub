"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import {
  PrintDocumentLayout,
  PrintField,
  PrintLineItemsTable,
  PrintSection,
  PrintTotals,
} from "@/components/shared/print-document-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useShop } from "@/lib/hooks/use-shop";
import { downloadPDF, generateJobOrderPDF } from "@/lib/pdf/generator";
import { printPDF } from "@/lib/pdf/print-pdf";
import { formatCurrency, formatDate, formatQuantity } from "@/lib/utils";
import { getJobOrder, getJobOrderReleaseEligibility } from "../actions";

interface JobOrderViewProps {
  jobOrderId: string;
}

export function JobOrderView({ jobOrderId }: JobOrderViewProps) {
  const { shop } = useShop();

  const { data: jobOrder, isLoading } = useQuery({
    queryKey: ["job-order", jobOrderId],
    queryFn: async () => {
      const result = await getJobOrder(jobOrderId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const { data: releaseInfo } = useQuery({
    queryKey: ["job-order-release", jobOrderId],
    queryFn: async () => {
      const result = await getJobOrderReleaseEligibility(jobOrderId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!jobOrder && jobOrder.status !== "released",
  });

  const handleExportPDF = async () => {
    if (!shop || !jobOrder) return;
    try {
      const doc = await generateJobOrderPDF(shop, jobOrder);
      downloadPDF(doc, `${jobOrder.job_order_number}.pdf`);
    } catch {
      toast.error("Failed to generate PDF");
    }
  };

  const handlePrint = async () => {
    if (!shop || !jobOrder) return;
    try {
      const doc = await generateJobOrderPDF(shop, jobOrder);
      printPDF(doc);
    } catch {
      toast.error("Failed to open print preview");
    }
  };

  const partsTotal =
    jobOrder?.job_order_parts?.reduce(
      (sum, part) => sum + Number(part.total_price),
      0
    ) ?? 0;
  const laborCost = Number(jobOrder?.labor_cost ?? jobOrder?.repair_estimates?.labor_cost ?? 0);
  const jobOrderTotal = partsTotal + laborCost;

  if (isLoading) {
    return <p className="text-muted-foreground">Loading job order...</p>;
  }

  if (!jobOrder) {
    return <p className="text-destructive">Job order not found.</p>;
  }

  const documentDate =
    jobOrder.date_started?.split("T")[0] ??
    jobOrder.created_at.split("T")[0];

  return (
    <>
      <div className="space-y-6 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/job-orders">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to job orders</span>
            </Link>
          </Button>
          <PageHeader
            title={jobOrder.job_order_number}
            description={`Job order for ${jobOrder.customers?.full_name ?? "Unknown"}`}
            className="flex-1"
          >
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button variant="outline" onClick={handleExportPDF}>
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </PageHeader>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Status</CardDescription>
              <CardTitle className="text-base">
                <StatusBadge status={jobOrder.status} />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Technician</CardDescription>
              <CardTitle className="text-base">
                {jobOrder.assigned_technician ?? "—"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Date Started</CardDescription>
              <CardTitle className="text-base">
                {jobOrder.date_started
                  ? formatDate(jobOrder.date_started)
                  : "—"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Date Completed</CardDescription>
              <CardTitle className="text-base">
                {jobOrder.date_completed
                  ? formatDate(jobOrder.date_completed)
                  : "—"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {jobOrder.status === "released" && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <strong>Released.</strong> Vehicle turnover is complete. This job
            order cannot be deleted.
          </div>
        )}

        {jobOrder.invoices?.[0] && jobOrder.status !== "released" && (
          <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-900 dark:text-blue-100">
            <strong>Linked invoice.</strong> Invoice{" "}
            {jobOrder.invoices[0].invoice_number} is tied to this job order. It
            cannot be deleted while the invoice exists.
          </div>
        )}

        {jobOrder.status === "completed" &&
          releaseInfo &&
          !releaseInfo.canRelease && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              <strong>Not ready for release.</strong> {releaseInfo.message}{" "}
              Record full payment on the invoice before setting status to
              Released.
            </div>
          )}

        {jobOrder.repair_estimates && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Source Estimate</CardDescription>
              <CardTitle className="text-base">
                <Link
                  href={`/dashboard/estimates/${jobOrder.estimate_id}`}
                  className="text-primary hover:underline"
                >
                  {jobOrder.repair_estimates.estimate_number}
                </Link>
              </CardTitle>
            </CardHeader>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{jobOrder.customers?.full_name}</p>
              <p>{jobOrder.customers?.contact_number ?? "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Vehicle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">
                {jobOrder.vehicles?.brand} {jobOrder.vehicles?.model}
              </p>
              <p>Plate: {jobOrder.vehicles?.plate_number}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Repair Description</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {jobOrder.repair_description || "—"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parts Used</CardTitle>
          </CardHeader>
          <CardContent>
            {!jobOrder.job_order_parts?.length ? (
              <p className="text-sm text-muted-foreground">No parts recorded.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part Name</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobOrder.job_order_parts.map((part) => (
                    <TableRow key={part.id}>
                      <TableCell>{part.part_name}</TableCell>
                      <TableCell className="text-right">
                        {formatQuantity(part.quantity)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(part.unit_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(part.total_price)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {(laborCost > 0 || partsTotal > 0) && (
              <div className="mt-4 space-y-1 text-right">
                {laborCost > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Labor: {formatCurrency(laborCost)}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Parts total: {formatCurrency(partsTotal)}
                </p>
                <p className="text-base font-semibold">
                  Total: {formatCurrency(jobOrderTotal)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PrintDocumentLayout
        shop={shop}
        title="Job Order"
        documentNumber={jobOrder.job_order_number}
        date={documentDate}
      >
        <div className="grid grid-cols-2 gap-6">
          <PrintField
            label="Customer"
            value={
              <>
                <span className="font-medium">{jobOrder.customers?.full_name}</span>
                <br />
                {jobOrder.customers?.contact_number ?? "—"}
                <br />
                {jobOrder.customers?.email ?? "—"}
              </>
            }
          />
          <PrintField
            label="Vehicle"
            value={
              <>
                {jobOrder.vehicles?.brand} {jobOrder.vehicles?.model}
                <br />
                Plate: {jobOrder.vehicles?.plate_number}
                <br />
                Chassis: {jobOrder.vehicles?.chassis_number ?? "—"}
                <br />
                Engine: {jobOrder.vehicles?.engine_number ?? "—"}
              </>
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <PrintField
            label="Technician"
            value={jobOrder.assigned_technician ?? "—"}
          />
          <PrintField
            label="Status"
            value={jobOrder.status.replace("_", " ").toUpperCase()}
          />
          <PrintField
            label="Date Started"
            value={
              jobOrder.date_started ? formatDate(jobOrder.date_started) : "—"
            }
          />
          <PrintField
            label="Date Completed"
            value={
              jobOrder.date_completed
                ? formatDate(jobOrder.date_completed)
                : "—"
            }
          />
        </div>

        {jobOrder.repair_estimates?.estimate_number && (
          <PrintField
            label="Source Estimate"
            value={jobOrder.repair_estimates.estimate_number}
          />
        )}

        <PrintSection title="Repair Description">
          <p>{jobOrder.repair_description || "—"}</p>
        </PrintSection>

        <PrintSection title="Parts Used">
          <PrintLineItemsTable
            columns={[
              { key: "part", label: "Part Name" },
              { key: "qty", label: "Qty", align: "right" },
              { key: "unitPrice", label: "Unit Price", align: "right" },
              { key: "total", label: "Total", align: "right" },
            ]}
            rows={(jobOrder.job_order_parts ?? []).map((part) => ({
              part: part.part_name,
              qty: formatQuantity(part.quantity),
              unitPrice: formatCurrency(part.unit_price),
              total: formatCurrency(part.total_price),
            }))}
            emptyMessage="No parts recorded."
          />
        </PrintSection>

        <PrintTotals
          items={[
            ...(laborCost > 0
              ? [{ label: "Labor", value: formatCurrency(laborCost) }]
              : []),
            {
              label: "Parts Total",
              value: formatCurrency(partsTotal),
            },
            {
              label: "Total",
              value: formatCurrency(jobOrderTotal),
              emphasis: true,
            },
          ]}
        />
      </PrintDocumentLayout>
    </>
  );
}
