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
import { UNIT_CATEGORIES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { getCustomers } from "@/features/customers/actions";
import { getVehicles } from "@/features/vehicles/actions";
import type { UnitReceived } from "@/types/database";
import {
  createUnitReceived,
  deleteUnitReceived,
  getUnitsAnalytics,
  getUnitsReceived,
  updateUnitReceived,
  type UnitReceivedWithRelations,
} from "../actions";
import type { UnitReceivedFormValues } from "../schemas";
import { UnitsReceivedCharts } from "./units-received-charts";
import { UnitsReceivedDialog } from "./units-received-dialog";

function getCategoryLabel(value: string) {
  return UNIT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function UnitsReceivedTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<UnitReceived | undefined>();

  const { data: units = [], isLoading } = useQuery({
    queryKey: ["units-received", search],
    queryFn: async () => {
      const result = await getUnitsReceived(search);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["units-analytics"],
    queryFn: async () => {
      const result = await getUnitsAnalytics();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const result = await getCustomers();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-list"],
    queryFn: async () => {
      const result = await getVehicles();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: UnitReceivedFormValues) => {
      const result = await createUnitReceived(values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units-received"] });
      queryClient.invalidateQueries({ queryKey: ["units-analytics"] });
      toast.success("Unit received logged successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: UnitReceivedFormValues }) => {
      const result = await updateUnitReceived(id, values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units-received"] });
      queryClient.invalidateQueries({ queryKey: ["units-analytics"] });
      toast.success("Record updated successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteUnitReceived(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units-received"] });
      queryClient.invalidateQueries({ queryKey: ["units-analytics"] });
      setDeleteOpen(false);
      setSelectedUnit(undefined);
      toast.success("Record deleted successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSubmit = async (values: UnitReceivedFormValues) => {
    if (selectedUnit) {
      await updateMutation.mutateAsync({ id: selectedUnit.id, values });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const columns = useMemo<ColumnDef<UnitReceivedWithRelations>[]>(
    () => [
      {
        accessorKey: "received_date",
        header: "Date",
        cell: ({ row }) => formatDate(row.original.received_date),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => getCategoryLabel(row.original.category),
      },
      {
        id: "customer",
        header: "Customer",
        cell: ({ row }) => row.original.customers?.full_name ?? "—",
      },
      {
        id: "vehicle",
        header: "Vehicle",
        cell: ({ row }) => {
          const v = row.original.vehicles;
          return v ? `${v.plate_number} — ${v.brand} ${v.model}` : "—";
        },
      },
      {
        accessorKey: "notes",
        header: "Notes",
        cell: ({ row }) => row.original.notes ?? "—",
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
                  setSelectedUnit(row.original);
                  setDialogOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  setSelectedUnit(row.original);
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
        title="Units Received"
        description="Track vehicles received for service by category."
      >
        <Button
          onClick={() => {
            setSelectedUnit(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Log Unit
        </Button>
      </PageHeader>

      {analyticsLoading ? (
        <LoadingSpinner />
      ) : analytics ? (
        <UnitsReceivedCharts data={analytics} />
      ) : null}

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by category or notes..."
      />

      <DataTable
        columns={columns}
        data={units}
        emptyMessage={isLoading ? "Loading records..." : "No units received found."}
      />

      <UnitsReceivedDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        unit={selectedUnit}
        customers={customers}
        vehicles={vehicles}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Record"
        description="Are you sure you want to delete this unit received record?"
        onConfirm={() => selectedUnit && deleteMutation.mutate(selectedUnit.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
