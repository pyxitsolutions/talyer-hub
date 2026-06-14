"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Eye, FileText, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { TablePagination } from "@/components/shared/table-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { LIST_PAGE_SIZE } from "@/lib/constants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInvalidateDashboard } from "@/lib/hooks/use-invalidate-dashboard";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  createInvoice,
  deleteInvoice,
  getCustomersForSelect,
  getInventoryForSelect,
  getInvoice,
  getInvoices,
  getJobOrdersForSelect,
  getVehiclesForSelect,
  updateInvoice,
  type InvoiceListItem,
} from "../actions";
import type { InvoiceFormValues } from "../schemas";
import { InvoiceDialog } from "./invoice-dialog";

function getInvoiceDeleteBlockReason(invoice: InvoiceListItem): string | null {
  if (invoice.job_orders?.status === "released") {
    return `Cannot delete: job order ${invoice.job_orders.job_order_number} is already released.`;
  }

  return null;
}

export function InvoiceTable() {
  const queryClient = useQueryClient();
  const invalidateDashboard = useInvalidateDashboard();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<
    InvoiceListItem | undefined
  >();
  const [selectedJobOrderId, setSelectedJobOrderId] = useState("");
  const [prefillJobOrderId, setPrefillJobOrderId] = useState<string | undefined>();

  useEffect(() => {
    setPage(1);
  }, [search]);

  const { data: invoicesResult, isLoading } = useQuery({
    queryKey: ["invoices", search, page],
    queryFn: async () => {
      const result = await getInvoices(search, page, LIST_PAGE_SIZE);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const invoices = invoicesResult?.items ?? [];
  const totalInvoices = invoicesResult?.total ?? 0;

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-select"],
    queryFn: async () => {
      const result = await getCustomersForSelect();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: dialogOpen,
    staleTime: 5 * 60 * 1000,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-select"],
    queryFn: async () => {
      const result = await getVehiclesForSelect();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: dialogOpen,
    staleTime: 5 * 60 * 1000,
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory-select"],
    queryFn: async () => {
      const result = await getInventoryForSelect();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: dialogOpen,
    staleTime: 5 * 60 * 1000,
  });

  const { data: jobOrders = [] } = useQuery({
    queryKey: ["job-orders-select"],
    queryFn: async () => {
      const result = await getJobOrdersForSelect();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    staleTime: 60 * 1000,
  });

  const { data: invoiceForEdit, isLoading: editLoading } = useQuery({
    queryKey: ["invoice", selectedInvoice?.id, "edit"],
    queryFn: async () => {
      const result = await getInvoice(selectedInvoice!.id);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: dialogOpen && !!selectedInvoice?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (values: InvoiceFormValues) => {
      const result = await createInvoice(values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["job-orders-select"] });
      invalidateDashboard();
      toast.success("Invoice created successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: InvoiceFormValues }) => {
      const result = await updateInvoice(id, values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      invalidateDashboard();
      toast.success("Invoice updated successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteInvoice(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      invalidateDashboard();
      setDeleteOpen(false);
      setSelectedInvoice(undefined);
      toast.success("Invoice deleted successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setPrefillJobOrderId(undefined);
      setSelectedInvoice(undefined);
    }
  };

  const handleSubmit = async (values: InvoiceFormValues) => {
    if (selectedInvoice) {
      await updateMutation.mutateAsync({ id: selectedInvoice.id, values });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const columns = useMemo<ColumnDef<(typeof invoices)[number]>[]>(
    () => [
      { accessorKey: "invoice_number", header: "Invoice #" },
      {
        accessorKey: "customers.full_name",
        header: "Customer",
        cell: ({ row }) => row.original.customers?.full_name ?? "—",
      },
      {
        accessorKey: "vehicles.plate_number",
        header: "Vehicle",
        cell: ({ row }) => {
          const v = row.original.vehicles;
          return v ? `${v.plate_number} — ${v.brand} ${v.model}` : "—";
        },
      },
      {
        accessorKey: "total_amount",
        header: "Total",
        cell: ({ row }) => formatCurrency(row.original.total_amount),
      },
      {
        accessorKey: "payment_status",
        header: "Payment",
        cell: ({ row }) => <StatusBadge status={row.original.payment_status} />,
      },
      {
        accessorKey: "invoice_date",
        header: "Date",
        cell: ({ row }) => formatDate(row.original.invoice_date),
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
                <Link href={`/dashboard/invoices/${row.original.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View / Print
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedInvoice(row.original);
                  setDialogOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                disabled={!!getInvoiceDeleteBlockReason(row.original)}
                onClick={() => {
                  const blockReason = getInvoiceDeleteBlockReason(row.original);
                  if (blockReason) {
                    toast.error(blockReason);
                    return;
                  }
                  setSelectedInvoice(row.original);
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
        title="Invoices"
        description="Manage billing invoices, payments, and generate from job orders."
      >
        <Button
          onClick={() => {
            setSelectedInvoice(undefined);
            setPrefillJobOrderId(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Invoice
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by invoice number or technician..."
          className="flex-1"
        />
        <div className="flex gap-2">
          <Select value={selectedJobOrderId} onValueChange={setSelectedJobOrderId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="From job order..." />
            </SelectTrigger>
            <SelectContent>
              {jobOrders.map((jo) => (
                <SelectItem key={jo.id} value={jo.id}>
                  {jo.job_order_number} ({jo.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            disabled={!selectedJobOrderId}
            onClick={() => {
              setSelectedInvoice(undefined);
              setPrefillJobOrderId(selectedJobOrderId);
              setDialogOpen(true);
            }}
          >
            <FileText className="mr-2 h-4 w-4" />
            Create from Job Order
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={invoices}
        emptyMessage={isLoading ? "Loading invoices..." : "No invoices found."}
      />

      <TablePagination
        page={page}
        pageSize={LIST_PAGE_SIZE}
        total={totalInvoices}
        onPageChange={setPage}
      />

      <InvoiceDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        invoice={selectedInvoice ? invoiceForEdit : undefined}
        jobOrders={jobOrders}
        initialJobOrderId={prefillJobOrderId}
        customers={customers}
        vehicles={vehicles}
        inventory={inventory}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
        editLoading={!!selectedInvoice && editLoading}
      />

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Invoice"
        description={`Are you sure you want to delete invoice ${selectedInvoice?.invoice_number}?`}
        onConfirm={() => selectedInvoice && deleteMutation.mutate(selectedInvoice.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
