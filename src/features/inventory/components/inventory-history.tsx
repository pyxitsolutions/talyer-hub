"use client";

import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { getHistory } from "../actions";

interface InventoryHistoryProps {
  inventoryItemId?: string;
}

const typeLabels: Record<string, string> = {
  stock_in: "Stock In",
  stock_out: "Stock Out",
  adjustment: "Adjustment",
};

const typeColors: Record<string, string> = {
  stock_in: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  stock_out: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  adjustment: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

export function InventoryHistory({ inventoryItemId }: InventoryHistoryProps) {
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["inventory-history", inventoryItemId],
    queryFn: async () => {
      const result = await getHistory(inventoryItemId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Stock History
        </CardTitle>
        <CardDescription>
          Recent inventory transactions
          {inventoryItemId ? " for this item" : " across all items"}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading history...</p>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={History}
            title="No transactions yet"
            description="Stock movements will appear here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                {!inventoryItemId && <TableHead>Part</TableHead>}
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{formatDate(tx.created_at)}</TableCell>
                  {!inventoryItemId && (
                    <TableCell>
                      {tx.inventory_items?.part_name ?? "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={typeColors[tx.transaction_type]}
                    >
                      {typeLabels[tx.transaction_type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{tx.quantity}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tx.reference_type ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">
                    {tx.notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
