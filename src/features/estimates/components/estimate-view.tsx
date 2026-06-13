"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Download,
  Printer,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
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
import { convertFromEstimate } from "@/features/job-orders/actions";
import { useShop } from "@/lib/hooks/use-shop";
import {
  downloadPDF,
  generateEstimatePDF,
} from "@/lib/pdf/generator";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  approveEstimate,
  getEstimate,
  rejectEstimate,
} from "../actions";

interface EstimateViewProps {
  estimateId: string;
}

export function EstimateView({ estimateId }: EstimateViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { shop } = useShop();

  const { data: estimate, isLoading } = useQuery({
    queryKey: ["estimate", estimateId],
    queryFn: async () => {
      const result = await getEstimate(estimateId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
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

  const convertMutation = useMutation({
    mutationFn: async () => {
      const result = await convertFromEstimate(estimateId);
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

  if (isLoading) {
    return <p className="text-muted-foreground">Loading estimate...</p>;
  }

  if (!estimate) {
    return <p className="text-destructive">Estimate not found.</p>;
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center gap-4 print:hidden">
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
            {estimate.status === "approved" && (
              <Button
                onClick={() => convertMutation.mutate()}
                disabled={convertMutation.isPending}
              >
                <Wrench className="mr-2 h-4 w-4" />
                Convert to Job Order
              </Button>
            )}
          </div>
        </PageHeader>
      </div>

      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">{estimate.estimate_number}</h1>
        <p className="text-muted-foreground">Repair Estimate</p>
      </div>

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
  );
}
