"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { searchServiceHistory, type ServiceHistoryRecord } from "../actions";

export function ServiceHistoryTable() {
  const [search, setSearch] = useState("");

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["service-history", search],
    queryFn: async () => {
      const result = await searchServiceHistory(search);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const columns = useMemo<ColumnDef<ServiceHistoryRecord>[]>(
    () => [
      {
        accessorKey: "repair_date",
        header: "Repair Date",
        cell: ({ row }) =>
          row.original.repair_date ? formatDate(row.original.repair_date) : "—",
      },
      {
        accessorKey: "customer_name",
        header: "Customer",
      },
      {
        accessorKey: "plate_number",
        header: "Plate",
      },
      {
        accessorKey: "chassis_number",
        header: "Chassis",
        cell: ({ row }) => row.original.chassis_number ?? "—",
      },
      {
        accessorKey: "vehicle_info",
        header: "Vehicle",
      },
      {
        accessorKey: "repair_type",
        header: "Repair Type",
        cell: ({ row }) => (
          <span className="max-w-[200px] truncate" title={row.original.repair_type}>
            {row.original.repair_type}
          </span>
        ),
      },
      {
        accessorKey: "technician",
        header: "Technician",
        cell: ({ row }) => row.original.technician ?? "—",
      },
      {
        accessorKey: "invoice_number",
        header: "Invoice",
        cell: ({ row }) => row.original.invoice_number ?? "—",
      },
      {
        accessorKey: "cost",
        header: "Cost",
        cell: ({ row }) =>
          row.original.cost > 0 ? formatCurrency(row.original.cost) : "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-medium capitalize">
            {row.original.status}
          </Badge>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service History"
        description="Search repair history by customer name, plate number, or chassis number."
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by customer, plate, or chassis number..."
      />

      <DataTable
        columns={columns}
        data={records}
        emptyMessage={
          isLoading ? "Searching service history..." : "No service records found."
        }
      />
    </div>
  );
}
