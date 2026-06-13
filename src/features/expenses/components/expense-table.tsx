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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Expense } from "@/types/database";
import {
  createExpense,
  deleteExpense,
  getExpenseAnalytics,
  getExpenses,
  getPnLSummary,
  updateExpense,
} from "../actions";
import type { ExpenseFormValues } from "../schemas";
import { ExpenseCharts } from "./expense-charts";
import { ExpenseDialog } from "./expense-dialog";

function getCategoryLabel(value: string) {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function ExpenseTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | undefined>();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", search],
    queryFn: async () => {
      const result = await getExpenses(search);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["expense-analytics"],
    queryFn: async () => {
      const result = await getExpenseAnalytics();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: pnl } = useQuery({
    queryKey: ["pnl-summary"],
    queryFn: async () => {
      const result = await getPnLSummary();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: ExpenseFormValues) => {
      const result = await createExpense(values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["pnl-summary"] });
      toast.success("Expense added successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: ExpenseFormValues }) => {
      const result = await updateExpense(id, values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["pnl-summary"] });
      toast.success("Expense updated successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteExpense(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["pnl-summary"] });
      setDeleteOpen(false);
      setSelectedExpense(undefined);
      toast.success("Expense deleted successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSubmit = async (values: ExpenseFormValues) => {
    if (selectedExpense) {
      await updateMutation.mutateAsync({ id: selectedExpense.id, values });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const columns = useMemo<ColumnDef<Expense>[]>(
    () => [
      {
        accessorKey: "expense_date",
        header: "Date",
        cell: ({ row }) => formatDate(row.original.expense_date),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => getCategoryLabel(row.original.category),
      },
      {
        accessorKey: "description",
        header: "Description",
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
                  setSelectedExpense(row.original);
                  setDialogOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  setSelectedExpense(row.original);
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
        title="Expenses"
        description="Track shop expenses and view profit & loss summary."
      >
        <Button
          onClick={() => {
            setSelectedExpense(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </PageHeader>

      {pnl && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Monthly Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-green-600">
                {formatCurrency(pnl.totalSales)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Monthly Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-red-600">
                {formatCurrency(pnl.totalExpenses)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Net Profit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-semibold ${
                  pnl.netProfit >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatCurrency(pnl.netProfit)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Profit Margin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{pnl.profitMargin.toFixed(1)}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {analyticsLoading ? (
        <LoadingSpinner />
      ) : analytics ? (
        <ExpenseCharts data={analytics} />
      ) : null}

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by description or category..."
      />

      <DataTable
        columns={columns}
        data={expenses}
        emptyMessage={isLoading ? "Loading expenses..." : "No expenses found."}
      />

      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={selectedExpense}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Expense"
        description="Are you sure you want to delete this expense record?"
        onConfirm={() => selectedExpense && deleteMutation.mutate(selectedExpense.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
