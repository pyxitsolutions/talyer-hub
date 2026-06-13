"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Expense } from "@/types/database";
import type { ExpenseFormValues } from "../schemas";
import { ExpenseForm } from "./expense-form";

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense;
  onSubmit: (values: ExpenseFormValues) => Promise<void>;
  isLoading?: boolean;
}

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  onSubmit,
  isLoading = false,
}: ExpenseDialogProps) {
  const handleSubmit = async (values: ExpenseFormValues) => {
    await onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit Expense" : "Add Expense"}</DialogTitle>
          <DialogDescription>
            {expense
              ? "Update the expense record below."
              : "Record a shop expense with category and amount."}
          </DialogDescription>
        </DialogHeader>
        <ExpenseForm
          expense={expense}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
}
