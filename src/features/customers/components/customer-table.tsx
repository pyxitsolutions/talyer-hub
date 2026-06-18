"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Eye, MoreHorizontal, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";
import type { Customer } from "@/types/database";
import {
  createCustomer,
  getCustomers,
  updateCustomer,
} from "../actions";
import type { CustomerFormValues } from "../schemas";
import { CustomerDialog } from "./customer-dialog";
import { CustomerRemoveDialog } from "./customer-remove-dialog";

export function CustomerTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", search],
    queryFn: async () => {
      const result = await getCustomers(search);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      const result = await createCustomer(values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers-select"] });
      toast.success("Customer created successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: CustomerFormValues;
    }) => {
      const result = await updateCustomer(id, values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers-select"] });
      toast.success("Customer updated successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleRemoveSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["customers-select"] });
    queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    queryClient.invalidateQueries({ queryKey: ["vehicles-list"] });
    setRemoveOpen(false);
    setSelectedCustomer(undefined);
  };

  const handleSubmit = async (values: CustomerFormValues) => {
    if (selectedCustomer) {
      await updateMutation.mutateAsync({ id: selectedCustomer.id, values });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        accessorKey: "customer_number",
        header: "Customer #",
      },
      {
        accessorKey: "full_name",
        header: "Name",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span>{row.original.full_name}</span>
            {row.original.is_active === false && (
              <Badge variant="secondary">Deactivated</Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: "contact_number",
        header: "Contact",
        cell: ({ row }) => row.original.contact_number ?? "—",
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => row.original.email ?? "—",
      },
      {
        accessorKey: "created_at",
        header: "Created",
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
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/customers/${row.original.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </Link>
              </DropdownMenuItem>
              {row.original.is_active !== false && (
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedCustomer(row.original);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => {
                  setSelectedCustomer(row.original);
                  setRemoveOpen(true);
                }}
              >
                {row.original.is_active === false ? (
                  <>
                    <Undo2 className="mr-2 h-4 w-4" />
                    Reactivate
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </>
                )}
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
        title="Customers"
        description="Manage customer records. Collect only what you need and follow the Data Privacy Act for shop-held customer data."
      >
        <Button
          onClick={() => {
            setSelectedCustomer(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </PageHeader>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by name, number, contact, or email..."
      />

      <DataTable
        columns={columns}
        data={customers}
        emptyMessage={isLoading ? "Loading customers..." : "No customers found."}
      />

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customer={selectedCustomer}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <CustomerRemoveDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        customer={selectedCustomer}
        onSuccess={handleRemoveSuccess}
      />
    </div>
  );
}
