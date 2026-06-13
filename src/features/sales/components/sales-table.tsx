"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { SalesRecord } from "@/types/database";
import {
  createSalesRecord,
  deleteSalesRecord,
  getSalesAnalytics,
  getSalesRecords,
  updateSalesRecord,
} from "../actions";
import type { SalesFormValues } from "../schemas";
import { SalesCharts } from "./sales-charts";
import { SalesDialog } from "./sales-dialog";

const SALE_TYPE_LABELS: Record<string, string> = {
  parts: "Parts",
  materials: "Materials",
  labor: "Labor",
};

export function SalesTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SalesRecord | undefined>();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["sales", search],
    queryFn: async () => {
      const result = await getSalesRecords(search);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["sales-analytics"],
    queryFn: async () => {
      const result = await getSalesAnalytics();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: SalesFormValues) => {
      const result = await createSalesRecord(values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sales-analytics"] });
      toast.success("Sale recorded successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: SalesFormValues }) => {
      const result = await updateSalesRecord(id, values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sales-analytics"] });
      toast.success("Sale updated successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteSalesRecord(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sales-analytics"] });
      setDeleteOpen(false);
      setSelectedRecord(undefined);
      toast.success("Sale deleted successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSubmit = async (values: SalesFormValues) => {
    if (selectedRecord) {
      await updateMutation.mutateAsync({ id: selectedRecord.id, values });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const columns = useMemo<ColumnDef<SalesRecord>[]>(
    () => [
      {
        accessorKey: "sale_date",
        header: "Date",
        cell: ({ row }) => formatDate(row.original.sale_date),
      },
      {
        accessorKey: "sale_type",
        header: "Type",
        cell: ({ row }) => SALE_TYPE_LABELS[row.original.sale_type] ?? row.original.sale_type,
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => row.original.description ?? "—",
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => formatCurrency(row.original.amount),
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
              <DropdownMenuItem
                onClick={() => {
                  setSelectedRecord(row.original);
                  setDialogOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  setSelectedRecord(row.original);
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
        title="Sales"
        description="Track parts, materials, and labor sales with analytics."
      >
        <Button
          onClick={() => {
            setSelectedRecord(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Record Sale
        </Button>
      </PageHeader>

      {analyticsLoading ? (
        <LoadingSpinner />
      ) : analytics ? (
        <SalesCharts data={analytics} />
      ) : null}

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by description or type..."
      />

      <DataTable
        columns={columns}
        data={records}
        emptyMessage={isLoading ? "Loading sales..." : "No sales records found."}
      />

      <SalesDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        record={selectedRecord}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Sale"
        description="Are you sure you want to delete this sales record?"
        onConfirm={() => selectedRecord && deleteMutation.mutate(selectedRecord.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
