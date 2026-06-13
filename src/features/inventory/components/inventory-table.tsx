"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { DeleteDialog } from "@/components/shared/delete-dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatQuantity } from "@/lib/utils";
import type { InventoryItem } from "@/types/database";
import {
  adjustStock,
  createInventoryItem,
  deleteInventoryItem,
  getInventoryItems,
  getLowStock,
  stockIn,
  stockOut,
  updateInventoryItem,
} from "../actions";
import type { InventoryFormValues, StockAdjustmentValues, StockTransactionValues } from "../schemas";
import { InventoryDialog } from "./inventory-dialog";
import { InventoryHistory } from "./inventory-history";
import { StockDialog, type StockOperation } from "./stock-dialog";

export function InventoryTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | undefined>();
  const [stockOperation, setStockOperation] = useState<StockOperation>("stock_in");
  const [historyItemId, setHistoryItemId] = useState<string | undefined>();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory", search],
    queryFn: async () => {
      const result = await getInventoryItems(search);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: lowStockItems = [] } = useQuery({
    queryKey: ["inventory-low-stock"],
    queryFn: async () => {
      const result = await getLowStock();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: InventoryFormValues) => {
      const result = await createInventoryItem(values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-history"] });
      toast.success("Inventory item created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: InventoryFormValues }) => {
      const result = await updateInventoryItem(id, values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-low-stock"] });
      toast.success("Inventory item updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteInventoryItem(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-low-stock"] });
      setDeleteOpen(false);
      setSelectedItem(undefined);
      toast.success("Inventory item deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const stockMutation = useMutation({
    mutationFn: async ({
      id,
      operation,
      values,
    }: {
      id: string;
      operation: StockOperation;
      values: StockTransactionValues | StockAdjustmentValues;
    }) => {
      let result;
      if (operation === "stock_in") {
        result = await stockIn(id, values as StockTransactionValues);
      } else if (operation === "stock_out") {
        result = await stockOut(id, values as StockTransactionValues);
      } else {
        result = await adjustStock(id, values as StockAdjustmentValues);
      }
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-history"] });
      toast.success("Stock updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSubmit = async (values: InventoryFormValues) => {
    if (selectedItem) {
      await updateMutation.mutateAsync({ id: selectedItem.id, values });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const openStockDialog = (item: InventoryItem, operation: StockOperation) => {
    setSelectedItem(item);
    setStockOperation(operation);
    setStockOpen(true);
  };

  const isLowStock = (item: InventoryItem) => item.quantity <= item.reorder_level;

  const columns = useMemo<ColumnDef<InventoryItem>[]>(
    () => [
      { accessorKey: "part_number", header: "Part #" },
      { accessorKey: "part_name", header: "Name" },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => row.original.category ?? "—",
      },
      {
        accessorKey: "quantity",
        header: "Qty",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span>{formatQuantity(row.original.quantity)}</span>
            {isLowStock(row.original) && (
              <Badge variant="outline" className="border-transparent bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                Low Stock
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: "reorder_level",
        header: "Reorder At",
      },
      {
        accessorKey: "cost_price",
        header: "Cost",
        cell: ({ row }) => formatCurrency(row.original.cost_price),
      },
      {
        accessorKey: "selling_price",
        header: "Price",
        cell: ({ row }) => formatCurrency(row.original.selling_price),
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
              <DropdownMenuItem onClick={() => openStockDialog(row.original, "stock_in")}>
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                Stock In
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openStockDialog(row.original, "stock_out")}>
                <ArrowUpFromLine className="mr-2 h-4 w-4" />
                Stock Out
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openStockDialog(row.original, "adjustment")}>
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Adjust
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setHistoryItemId(row.original.id);
                }}
              >
                <History className="mr-2 h-4 w-4" />
                View History
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedItem(row.original);
                  setDialogOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  setSelectedItem(row.original);
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
        title="Inventory"
        description="Manage parts stock, pricing, and track movements."
      >
        <Button
          onClick={() => {
            setSelectedItem(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </PageHeader>

      {lowStockItems.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {lowStockItems.length} item{lowStockItems.length !== 1 ? "s" : ""} below reorder level
          </p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            {lowStockItems.map((i) => i.part_name).join(", ")}
          </p>
        </div>
      )}

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">All Items</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by part number, name, category, or supplier..."
          />
          <DataTable
            columns={columns}
            data={items}
            emptyMessage={isLoading ? "Loading inventory..." : "No inventory items found."}
          />
        </TabsContent>

        <TabsContent value="history">
          <InventoryHistory inventoryItemId={historyItemId} />
        </TabsContent>
      </Tabs>

      <InventoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={selectedItem}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <StockDialog
        open={stockOpen}
        onOpenChange={setStockOpen}
        item={selectedItem}
        operation={stockOperation}
        onSubmit={async (values) => {
          if (selectedItem) {
            await stockMutation.mutateAsync({
              id: selectedItem.id,
              operation: stockOperation,
              values,
            });
          }
        }}
        isLoading={stockMutation.isPending}
      />

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Inventory Item"
        description={`Are you sure you want to delete ${selectedItem?.part_name}?`}
        onConfirm={() => selectedItem && deleteMutation.mutate(selectedItem.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
