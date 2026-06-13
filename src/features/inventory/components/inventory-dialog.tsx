"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { InventoryItem } from "@/types/database";
import type { InventoryFormValues } from "../schemas";
import { InventoryForm } from "./inventory-form";

interface InventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: InventoryItem;
  onSubmit: (values: InventoryFormValues) => Promise<void>;
  isLoading?: boolean;
}

export function InventoryDialog({
  open,
  onOpenChange,
  item,
  onSubmit,
  isLoading = false,
}: InventoryDialogProps) {
  const handleSubmit = async (values: InventoryFormValues) => {
    await onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Inventory Item" : "Add Inventory Item"}</DialogTitle>
          <DialogDescription>
            {item
              ? "Update part details and pricing."
              : "Add a new part to your inventory."}
          </DialogDescription>
        </DialogHeader>
        <InventoryForm
          item={item}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
}
