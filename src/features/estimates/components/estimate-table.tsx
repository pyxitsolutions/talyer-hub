"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Check,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
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
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  approveEstimate,
  createEstimate,
  deleteEstimate,
  getCustomersForSelect,
  getEstimate,
  getEstimates,
  getInventoryForSelect,
  rejectEstimate,
  updateEstimate,
  type EstimateListItem,
} from "../actions";
import type { EstimateFormValues } from "../schemas";
import { EstimateDialog } from "./estimate-dialog";

export function EstimateTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedEstimate, setSelectedEstimate] = useState<
    EstimateListItem | undefined
  >();

  useEffect(() => {
    setPage(1);
  }, [search]);

  const { data: estimatesResult, isLoading } = useQuery({
    queryKey: ["estimates", search, page],
    queryFn: async () => {
      const result = await getEstimates(search, page, LIST_PAGE_SIZE);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const estimates = estimatesResult?.items ?? [];
  const totalEstimates = estimatesResult?.total ?? 0;

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

  const { data: estimateForEdit, isLoading: editLoading } = useQuery({
    queryKey: ["estimate", selectedEstimate?.id, "edit"],
    queryFn: async () => {
      const result = await getEstimate(selectedEstimate!.id);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: dialogOpen && !!selectedEstimate?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (values: EstimateFormValues) => {
      const result = await createEstimate(values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      toast.success("Estimate created successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: EstimateFormValues;
    }) => {
      const result = await updateEstimate(id, values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      toast.success("Estimate updated successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteEstimate(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      setDeleteOpen(false);
      setSelectedEstimate(undefined);
      toast.success("Estimate deleted successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await approveEstimate(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      toast.success("Estimate approved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await rejectEstimate(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      toast.success("Estimate rejected");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSubmit = async (values: EstimateFormValues) => {
    if (selectedEstimate) {
      await updateMutation.mutateAsync({ id: selectedEstimate.id, values });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const columns = useMemo<ColumnDef<EstimateListItem>[]>(
    () => [
      {
        accessorKey: "estimate_number",
        header: "Estimate #",
        cell: ({ row }) => (
          <Link
            href={`/dashboard/estimates/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.estimate_number}
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
        accessorKey: "total_cost",
        header: "Total",
        cell: ({ row }) => formatCurrency(row.original.total_cost),
      },
      {
        accessorKey: "estimate_date",
        header: "Date",
        cell: ({ row }) => formatDate(row.original.estimate_date),
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
                <Link href={`/dashboard/estimates/${row.original.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </Link>
              </DropdownMenuItem>
              {row.original.status === "draft" && (
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedEstimate(row.original);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => approveMutation.mutate(row.original.id)}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => rejectMutation.mutate(row.original.id)}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      setSelectedEstimate(row.original);
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [approveMutation, rejectMutation]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repair Estimates"
        description="One open estimate per vehicle. Finish and release the visit before starting another."
      >
        <Button
          onClick={() => {
            setSelectedEstimate(undefined);
            setDialogOpen(true);
          }}
          disabled={false}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Estimate
        </Button>
      </PageHeader>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by estimate number or technician..."
      />

      <DataTable
        columns={columns}
        data={estimates}
        emptyMessage={isLoading ? "Loading estimates..." : "No estimates found."}
      />

      <TablePagination
        page={page}
        pageSize={LIST_PAGE_SIZE}
        total={totalEstimates}
        onPageChange={setPage}
      />

      <EstimateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        estimate={selectedEstimate ? estimateForEdit : undefined}
        customers={customers}
        inventory={inventory}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
        editLoading={!!selectedEstimate && editLoading}
      />

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Estimate"
        description={`Are you sure you want to delete estimate ${selectedEstimate?.estimate_number}?`}
        onConfirm={() =>
          selectedEstimate && deleteMutation.mutate(selectedEstimate.id)
        }
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
