"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Download,
  Printer,
  Undo2,
  Wrench,
  X,
} from "lucide-react";
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
import { convertFromEstimate, getAvailableUnitsForJobOrder } from "@/features/job-orders/actions";
import { useShop } from "@/lib/hooks/use-shop";
import { UNIT_CATEGORIES } from "@/lib/constants";
import {
  downloadPDF,
  generateEstimatePDF,
} from "@/lib/pdf/generator";
import { formatCurrency, formatDate, formatQuantity } from "@/lib/utils";
import {
  approveEstimate,
  getEstimate,
  rejectEstimate,
  revertEstimateToDraft,
} from "../actions";

interface EstimateViewProps {
  estimateId: string;
}

export function EstimateView({ estimateId }: EstimateViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { shop } = useShop();
  const [selectedUnitId, setSelectedUnitId] = useState("");

  const { data: estimate, isLoading } = useQuery({
    queryKey: ["estimate", estimateId],
    queryFn: async () => {
      const result = await getEstimate(estimateId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: availableUnits = [] } = useQuery({
    queryKey: ["units-for-job-order", estimate?.vehicle_id],
    queryFn: async () => {
      if (!estimate?.vehicle_id) return [];
      const result = await getAvailableUnitsForJobOrder(estimate.vehicle_id);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!estimate?.vehicle_id && estimate.status === "approved",
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const result = await approveEstimate(estimateId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimate", estimateId] });
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      toast.success("Estimate approved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const result = await rejectEstimate(estimateId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimate", estimateId] });
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      toast.success("Estimate rejected");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revertMutation = useMutation({
    mutationFn: async () => {
      const result = await revertEstimateToDraft(estimateId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimate", estimateId] });
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      toast.success("Estimate moved back to draft");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      const result = await convertFromEstimate(estimateId, selectedUnitId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (jobOrder) => {
      queryClient.invalidateQueries({ queryKey: ["estimate", estimateId] });
      queryClient.invalidateQueries({ queryKey: ["job-orders"] });
      toast.success("Job order created from estimate");
      router.push(`/dashboard/job-orders/${jobOrder.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleExportPDF = async () => {
    if (!shop || !estimate) return;
    try {
      const doc = await generateEstimatePDF(shop, estimate);
      downloadPDF(doc, `${estimate.estimate_number}.pdf`);
    } catch {
      toast.error("Failed to generate PDF");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getUnitCategoryLabel = (category: string) =>
    UNIT_CATEGORIES.find((item) => item.value === category)?.label ?? category;

  if (isLoading) {
    return <p className="text-muted-foreground">Loading estimate...</p>;
  }

  if (!estimate) {
    return <p className="text-destructive">Estimate not found.</p>;
  }

  const linkedJobOrder = estimate.job_orders;

  return (
    <>
      <div className="space-y-6 print:hidden">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/estimates">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to estimates</span>
          </Link>
        </Button>
        <PageHeader
          title={estimate.estimate_number}
          description={`Estimate for ${estimate.customers?.full_name ?? "Unknown"}`}
          className="flex-1"
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button variant="outline" onClick={handleExportPDF}>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            {estimate.status === "draft" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => rejectMutation.mutate()}
                  disabled={rejectMutation.isPending}
                >
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </>
            )}
            {estimate.status === "approved" && !linkedJobOrder && (
              <>
                <Button
                  variant="outline"
                  onClick={() => revertMutation.mutate()}
                  disabled={revertMutation.isPending}
                >
                  <Undo2 className="mr-2 h-4 w-4" />
                  Back to Draft
                </Button>
                <Button
                  onClick={() => convertMutation.mutate()}
                  disabled={
                    convertMutation.isPending ||
                    !selectedUnitId ||
                    availableUnits.length === 0
                  }
                >
                  <Wrench className="mr-2 h-4 w-4" />
                  Convert to Job Order
                </Button>
              </>
            )}
          </div>
        </PageHeader>
      </div>

      {estimate.status === "released" && (
        <div className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-3 text-sm text-violet-900 dark:text-violet-100">
          <strong>Visit complete.</strong> This estimate is released. You can
          create a new estimate for this vehicle after logging a fresh unit in
          Units Received.
        </div>
      )}

      {linkedJobOrder && (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Linked Job Order</CardDescription>
            <CardTitle className="text-base">
              <Link
                href={`/dashboard/job-orders/${linkedJobOrder.id}`}
                className="text-primary hover:underline"
              >
                {linkedJobOrder.job_order_number}
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={linkedJobOrder.status} />
          </CardContent>
        </Card>
      )}

      {estimate.status === "approved" && !linkedJobOrder && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create Job Order</CardTitle>
            <CardDescription>
              Log a fresh unit in Units Received for this visit, then select it
              here before converting this estimate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Unit Received *</Label>
              <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                <SelectTrigger className="max-w-xl">
                  <SelectValue placeholder="Select a logged unit" />
                </SelectTrigger>
                <SelectContent>
                  {availableUnits.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {formatDate(unit.received_date)} —{" "}
                      {getUnitCategoryLabel(unit.category)}
                      {unit.notes ? ` (${unit.notes})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {availableUnits.length === 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                No current unit log is available for this vehicle. Log a fresh
                unit in{" "}
                <Link
                  href="/dashboard/units-received"
                  className="font-medium underline underline-offset-4"
                >
                  Units Received
                </Link>{" "}
                for this visit before creating a job order.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
            <CardTitle className="text-base">
              <StatusBadge status={estimate.status} />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Date</CardDescription>
            <CardTitle className="text-base">
              {formatDate(estimate.estimate_date)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Technician</CardDescription>
            <CardTitle className="text-base">
              {estimate.technician_name ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Cost</CardDescription>
            <CardTitle className="text-base">
              {formatCurrency(estimate.total_cost)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{estimate.customers?.full_name}</p>
            <p>{estimate.customers?.contact_number ?? "—"}</p>
            <p>{estimate.customers?.email ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vehicle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">
              {estimate.vehicles?.brand} {estimate.vehicles?.model}
            </p>
            <p>Plate: {estimate.vehicles?.plate_number}</p>
            <p>Chassis: {estimate.chassis_number ?? "—"}</p>
            <p>Engine: {estimate.engine_number ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="font-medium">Problem</p>
            <p className="text-muted-foreground">
              {estimate.problem_description || "—"}
            </p>
          </div>
          <div>
            <p className="font-medium">Repair Description</p>
            <p className="text-muted-foreground">
              {estimate.repair_description || "—"}
            </p>
          </div>
          <div>
            <p className="font-medium">Recommendation</p>
            <p className="text-muted-foreground">
              {estimate.recommendation || "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          {!estimate.repair_estimate_items?.length ? (
            <p className="text-sm text-muted-foreground">No items.</p>
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
                {estimate.repair_estimate_items.map((item) => (
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
          <div className="mt-4 flex flex-col items-end gap-1 text-sm">
            <p>Labor: {formatCurrency(estimate.labor_cost)}</p>
            <p>Parts: {formatCurrency(estimate.parts_cost)}</p>
            <p className="text-base font-semibold">
              Total: {formatCurrency(estimate.total_cost)}
            </p>
          </div>
        </CardContent>
      </Card>
      </div>

      <PrintDocumentLayout
        shop={shop}
        title="Repair Estimate"
        documentNumber={estimate.estimate_number}
        date={estimate.estimate_date}
      >
        <div className="grid grid-cols-2 gap-6">
          <PrintField
            label="Customer"
            value={
              <>
                <span className="font-medium">{estimate.customers?.full_name}</span>
                <br />
                {estimate.customers?.contact_number ?? "—"}
                <br />
                {estimate.customers?.email ?? "—"}
              </>
            }
          />
          <PrintField
            label="Vehicle"
            value={
              <>
                {estimate.vehicles?.brand} {estimate.vehicles?.model}
                <br />
                Plate: {estimate.vehicles?.plate_number}
                <br />
                Chassis: {estimate.chassis_number ?? "—"}
                <br />
                Engine: {estimate.engine_number ?? "—"}
              </>
            }
          />
        </div>

        {estimate.technician_name && (
          <PrintField label="Technician" value={estimate.technician_name} />
        )}

        <PrintSection title="Problem">
          <p>{estimate.problem_description || "—"}</p>
        </PrintSection>

        <PrintSection title="Repair Description">
          <p>{estimate.repair_description || "—"}</p>
        </PrintSection>

        {estimate.recommendation && (
          <PrintSection title="Recommendation">
            <p>{estimate.recommendation}</p>
          </PrintSection>
        )}

        <PrintSection title="Line Items">
          <PrintLineItemsTable
            columns={[
              { key: "part", label: "Part Name" },
              { key: "qty", label: "Qty", align: "right" },
              { key: "unitPrice", label: "Unit Price", align: "right" },
              { key: "total", label: "Total", align: "right" },
            ]}
            rows={(estimate.repair_estimate_items ?? []).map((item) => ({
              part: item.part_name,
              qty: formatQuantity(item.quantity),
              unitPrice: formatCurrency(item.unit_price),
              total: formatCurrency(item.total_price),
            }))}
          />
        </PrintSection>

        <PrintTotals
          items={[
            { label: "Labor", value: formatCurrency(estimate.labor_cost) },
            { label: "Parts", value: formatCurrency(estimate.parts_cost) },
            {
              label: "Total",
              value: formatCurrency(estimate.total_cost),
              emphasis: true,
            },
          ]}
        />
      </PrintDocumentLayout>
    </>
  );
}
