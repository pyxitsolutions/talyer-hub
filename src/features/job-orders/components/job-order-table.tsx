"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Eye, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useInvalidateDashboard } from "@/lib/hooks/use-invalidate-dashboard";
import { formatDate } from "@/lib/utils";
import {
  createJobOrder,
  deleteJobOrder,
  getCustomersForSelect,
  getInventoryForSelect,
  getJobOrders,
  updateJobOrder,
  type JobOrderWithRelations,
} from "../actions";
import type { JobOrderFormValues } from "../schemas";
import { JobOrderDialog } from "./job-order-dialog";

function getLinkedInvoiceNumber(jobOrder: JobOrderWithRelations): string | null {
  return jobOrder.invoices?.[0]?.invoice_number ?? null;
}

function getJobOrderDeleteBlockReason(
  jobOrder: JobOrderWithRelations
): string | null {
  if (jobOrder.status === "released") {
    return "Cannot delete: this job order is already released.";
  }

  const linkedInvoice = getLinkedInvoiceNumber(jobOrder);
  if (linkedInvoice) {
    return `Cannot delete: invoice ${linkedInvoice} is linked to this job order.`;
  }

  return null;
}

export function JobOrderTable() {
  const searchParams = useSearchParams();
  const initialEstimateId = searchParams.get("estimateId") ?? undefined;
  const queryClient = useQueryClient();
  const invalidateDashboard = useInvalidateDashboard();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedJobOrder, setSelectedJobOrder] = useState<
    JobOrderWithRelations | undefined
  >();

  useEffect(() => {
    if (initialEstimateId) {
      setSelectedJobOrder(undefined);
      setDialogOpen(true);
    }
  }, [initialEstimateId]);

  const { data: jobOrders = [], isLoading } = useQuery({
    queryKey: ["job-orders", search],
    queryFn: async () => {
      const result = await getJobOrders(search);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-select"],
    queryFn: async () => {
      const result = await getCustomersForSelect();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory-select"],
    queryFn: async () => {
      const result = await getInventoryForSelect();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: JobOrderFormValues) => {
      const result = await createJobOrder(values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-orders"] });
      queryClient.invalidateQueries({
        queryKey: ["approved-estimates-for-job-order"],
      });
      invalidateDashboard();
      toast.success("Job order created successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: JobOrderFormValues;
    }) => {
      const result = await updateJobOrder(id, values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-orders"] });
      invalidateDashboard();
      toast.success("Job order updated successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteJobOrder(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-orders"] });
      invalidateDashboard();
      setDeleteOpen(false);
      setSelectedJobOrder(undefined);
      toast.success("Job order deleted successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSubmit = async (values: JobOrderFormValues) => {
    if (selectedJobOrder) {
      await updateMutation.mutateAsync({ id: selectedJobOrder.id, values });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const columns = useMemo<ColumnDef<JobOrderWithRelations>[]>(
    () => [
      {
        accessorKey: "job_order_number",
        header: "Job Order #",
        cell: ({ row }) => (
          <Link
            href={`/dashboard/job-orders/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.job_order_number}
          </Link>
        ),
      },
      {
        id: "customer",
        header: "Customer",
        cell: ({ row }) => row.original.customers?.full_name ?? "—",
      },
      {
        id: "vehicle",
        header: "Vehicle",
        cell: ({ row }) =>
          row.original.vehicles
            ? `${row.original.vehicles.plate_number} — ${row.original.vehicles.brand} ${row.original.vehicles.model}`
            : "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "assigned_technician",
        header: "Technician",
        cell: ({ row }) => row.original.assigned_technician ?? "—",
      },
      {
        accessorKey: "date_started",
        header: "Started",
        cell: ({ row }) =>
          row.original.date_started
            ? formatDate(row.original.date_started)
            : "—",
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/job-orders/${row.original.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedJobOrder(row.original);
                  setDialogOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                disabled={!!getJobOrderDeleteBlockReason(row.original)}
                onClick={() => {
                  const blockReason = getJobOrderDeleteBlockReason(row.original);
                  if (blockReason) {
                    toast.error(blockReason);
                    return;
                  }
                  setSelectedJobOrder(row.original);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Orders"
        description="Create job orders from approved estimates and track repair status."
      >
        <Button
          onClick={() => {
            setSelectedJobOrder(undefined);
            setDialogOpen(true);
          }}
          disabled={customers.length === 0}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Job Order from Estimate
        </Button>
      </PageHeader>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by job order number or technician..."
      />

      <DataTable
        columns={columns}
        data={jobOrders}
        emptyMessage={
          isLoading ? "Loading job orders..." : "No job orders found."
        }
      />

      <JobOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        jobOrder={selectedJobOrder}
        customers={customers}
        inventory={inventory}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
        initialEstimateId={selectedJobOrder ? undefined : initialEstimateId}
      />

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Job Order"
        description={`Are you sure you want to delete job order ${selectedJobOrder?.job_order_number}? Inventory will be restored for linked parts.`}
        onConfirm={() =>
          selectedJobOrder && deleteMutation.mutate(selectedJobOrder.id)
        }
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
