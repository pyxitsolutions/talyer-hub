"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SalesRecord } from "@/types/database";
import type { SalesFormValues } from "../schemas";
import { SalesForm } from "./sales-form";

interface SalesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: SalesRecord;
  onSubmit: (values: SalesFormValues) => Promise<void>;
  isLoading?: boolean;
}

export function SalesDialog({
  open,
  onOpenChange,
  record,
  onSubmit,
  isLoading = false,
}: SalesDialogProps) {
  const handleSubmit = async (values: SalesFormValues) => {
    await onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{record ? "Edit Sale" : "Record Sale"}</DialogTitle>
          <DialogDescription>
            {record
              ? "Update the sales record below."
              : "Enter sale details for parts, materials, or labor."}
          </DialogDescription>
        </DialogHeader>
        <SalesForm
          record={record}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
}
