"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";
import {
  createVehicle,
  deleteVehicle,
  getCustomersForSelect,
  getVehicles,
  updateVehicle,
  type VehicleWithCustomer,
} from "../actions";
import type { VehicleFormValues } from "../schemas";
import { VehicleDialog } from "./vehicle-dialog";

export function VehicleTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<
    VehicleWithCustomer | undefined
  >();

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["vehicles", search],
    queryFn: async () => {
      const result = await getVehicles(search);
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

  const createMutation = useMutation({
    mutationFn: async (values: VehicleFormValues) => {
      const result = await createVehicle(values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Vehicle created successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: VehicleFormValues;
    }) => {
      const result = await updateVehicle(id, values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Vehicle updated successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteVehicle(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setDeleteOpen(false);
      setSelectedVehicle(undefined);
      toast.success("Vehicle deleted successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSubmit = async (values: VehicleFormValues) => {
    if (selectedVehicle) {
      await updateMutation.mutateAsync({ id: selectedVehicle.id, values });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const columns = useMemo<ColumnDef<VehicleWithCustomer>[]>(
    () => [
      {
        accessorKey: "plate_number",
        header: "Plate #",
      },
      {
        accessorKey: "brand",
        header: "Brand",
      },
      {
        accessorKey: "model",
        header: "Model",
      },
      {
        accessorKey: "year_model",
        header: "Year",
        cell: ({ row }) => row.original.year_model ?? "—",
      },
      {
        id: "customer",
        header: "Customer",
        cell: ({ row }) => (
          <Link
            href={`/dashboard/customers/${row.original.customer_id}`}
            className="text-primary hover:underline"
          >
            {row.original.customers?.full_name ?? "—"}
          </Link>
        ),
      },
      {
        accessorKey: "color",
        header: "Color",
        cell: ({ row }) => row.original.color ?? "—",
      },
      {
        accessorKey: "created_at",
        header: "Registered",
        cell: ({ row }) => formatDate(row.original.created_at),
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
                  setSelectedVehicle(row.original);
                  setDialogOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  setSelectedVehicle(row.original);
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
        title="Vehicles"
        description="Manage registered vehicles and their owners."
      >
        <Button
          onClick={() => {
            setSelectedVehicle(undefined);
            setDialogOpen(true);
          }}
          disabled={customers.length === 0}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Vehicle
        </Button>
      </PageHeader>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by plate, brand, model, or chassis..."
      />

      <DataTable
        columns={columns}
        data={vehicles}
        emptyMessage={isLoading ? "Loading vehicles..." : "No vehicles found."}
      />

      <VehicleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vehicle={selectedVehicle}
        customers={customers}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Vehicle"
        description={`Are you sure you want to delete vehicle ${selectedVehicle?.plate_number}?`}
        onConfirm={() =>
          selectedVehicle && deleteMutation.mutate(selectedVehicle.id)
        }
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
