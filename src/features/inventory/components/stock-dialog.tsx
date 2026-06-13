"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { InventoryItem } from "@/types/database";
import {
  stockAdjustmentSchema,
  stockTransactionSchema,
  type StockAdjustmentValues,
  type StockTransactionValues,
} from "../schemas";

export type StockOperation = "stock_in" | "stock_out" | "adjustment";

interface StockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: InventoryItem;
  operation: StockOperation;
  onSubmit: (
    values: StockTransactionValues | StockAdjustmentValues
  ) => Promise<void>;
  isLoading?: boolean;
}

const titles: Record<StockOperation, string> = {
  stock_in: "Stock In",
  stock_out: "Stock Out",
  adjustment: "Adjust Stock",
};

export function StockDialog({
  open,
  onOpenChange,
  item,
  operation,
  onSubmit,
  isLoading = false,
}: StockDialogProps) {
  const transactionForm = useForm<StockTransactionValues>({
    resolver: zodResolver(stockTransactionSchema),
    defaultValues: { quantity: 1, notes: "" },
  });

  const adjustmentForm = useForm<StockAdjustmentValues>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: {
      new_quantity: item?.quantity ?? 0,
      notes: "",
    },
  });

  const handleTransactionSubmit = async (values: StockTransactionValues) => {
    await onSubmit(values);
    transactionForm.reset({ quantity: 1, notes: "" });
    onOpenChange(false);
  };

  const handleAdjustmentSubmit = async (values: StockAdjustmentValues) => {
    await onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titles[operation]}</DialogTitle>
          <DialogDescription>
            {item
              ? `${item.part_name} (${item.part_number}) — Current stock: ${item.quantity}`
              : "Select an item first."}
          </DialogDescription>
        </DialogHeader>

        {operation === "adjustment" ? (
          <form
            onSubmit={adjustmentForm.handleSubmit(handleAdjustmentSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="new_quantity">New Quantity</Label>
              <Input
                id="new_quantity"
                type="number"
                step="1"
                min="0"
                {...adjustmentForm.register("new_quantity")}
              />
              {adjustmentForm.formState.errors.new_quantity && (
                <p className="text-sm text-destructive">
                  {adjustmentForm.formState.errors.new_quantity.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="adj_notes">Notes</Label>
              <Textarea id="adj_notes" rows={2} {...adjustmentForm.register("notes")} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Adjust"}
              </Button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={transactionForm.handleSubmit(handleTransactionSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                step="1"
                min="1"
                {...transactionForm.register("quantity")}
              />
              {transactionForm.formState.errors.quantity && (
                <p className="text-sm text-destructive">
                  {transactionForm.formState.errors.quantity.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={2} {...transactionForm.register("notes")} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : titles[operation]}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
