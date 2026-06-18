"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { TablePagination } from "@/components/shared/table-pagination";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACTIVITY_ACTION_LABELS, LIST_PAGE_SIZE, ROLE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { ActivityLog } from "@/types/database";
import { getActivityLogs } from "../actions";

const ACTION_FILTER_OPTIONS = [
  { value: "all", label: "All actions" },
  { value: "unit_received", label: ACTIVITY_ACTION_LABELS.unit_received },
  { value: "estimate_created", label: ACTIVITY_ACTION_LABELS.estimate_created },
  { value: "estimate_approved", label: ACTIVITY_ACTION_LABELS.estimate_approved },
  { value: "job_order_released", label: ACTIVITY_ACTION_LABELS.job_order_released },
  { value: "invoice_created", label: ACTIVITY_ACTION_LABELS.invoice_created },
  { value: "invoice_paid", label: ACTIVITY_ACTION_LABELS.invoice_paid },
];

export function ActivityLogView() {
  const [search, setSearch] = useState("");
  const [actionType, setActionType] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, actionType]);

  const { data: result, isLoading, error } = useQuery({
    queryKey: ["activity-logs", search, actionType, page],
    queryFn: async () => {
      const response = await getActivityLogs(search, actionType, page, LIST_PAGE_SIZE);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
  });

  const logs = result?.items ?? [];
  const total = result?.total ?? 0;

  const columns = useMemo<ColumnDef<ActivityLog>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: "When",
        cell: ({ row }) => formatDateTime(row.original.created_at),
      },
      {
        accessorKey: "action_type",
        header: "Action",
        cell: ({ row }) => (
          <Badge variant="outline">
            {ACTIVITY_ACTION_LABELS[row.original.action_type] ??
              row.original.action_type}
          </Badge>
        ),
      },
      {
        accessorKey: "summary",
        header: "Details",
        cell: ({ row }) => (
          <div>
            <p>{row.original.summary}</p>
            {row.original.entity_label && (
              <p className="text-xs text-muted-foreground">
                Ref: {row.original.entity_label}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "actor_name",
        header: "User",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.actor_name}</p>
            {row.original.actor_role && (
              <p className="text-xs text-muted-foreground">
                {ROLE_LABELS[row.original.actor_role] ?? row.original.actor_role}
              </p>
            )}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Log"
        description="Track who logged units, created or approved estimates, released job orders, and handled invoices."
      />

      {error instanceof Error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error.message}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by user, summary, or reference..."
          className="flex-1"
        />
        <Select value={actionType} onValueChange={setActionType}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Filter action" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        emptyMessage={isLoading ? "Loading activity..." : "No activity recorded yet."}
      />

      <TablePagination
        page={page}
        pageSize={LIST_PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />
    </div>
  );
}
