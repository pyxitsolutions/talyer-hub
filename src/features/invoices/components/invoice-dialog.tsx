"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Customer, InventoryItem, Invoice, JobOrder, Vehicle } from "@/types/database";
import type { InvoiceFormValues } from "../schemas";
import { InvoiceForm } from "./invoice-form";

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: Invoice & {
    invoice_items?: {
      inventory_item_id: string | null;
      part_name: string;
      quantity: number;
      unit_price: number;
    }[];
  };
  customers: Pick<Customer, "id" | "full_name" | "customer_number">[];
  vehicles: Pick<Vehicle, "id" | "plate_number" | "brand" | "model" | "customer_id">[];
  inventory: Pick<InventoryItem, "id" | "part_number" | "part_name" | "selling_price" | "quantity">[];
  jobOrders?: Pick<JobOrder, "id" | "job_order_number" | "status">[];
  createFormKey?: number;
  onSubmit: (values: InvoiceFormValues) => Promise<void>;
  isLoading?: boolean;
  editLoading?: boolean;
}

export function InvoiceDialog({
  open,
  onOpenChange,
  invoice,
  customers,
  vehicles,
  inventory,
  jobOrders,
  createFormKey = 0,
  onSubmit,
  isLoading = false,
  editLoading = false,
}: InvoiceDialogProps) {
  const handleSubmit = async (values: InvoiceFormValues) => {
    await onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{invoice ? "Edit Invoice" : "Create Invoice"}</DialogTitle>
          <DialogDescription>
            {invoice
              ? "Update invoice details and line items."
              : "Select a completed job order to create an invoice. Customer, parts, and labor are copied automatically."}
          </DialogDescription>
        </DialogHeader>
        {editLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading invoice...
          </p>
        ) : (
        <InvoiceForm
          key={invoice?.id ?? `create-${createFormKey}`}
          invoice={invoice}
          jobOrders={jobOrders}
          customers={customers}
          vehicles={vehicles}
          inventory={inventory}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isLoading={isLoading}
        />
        )}
      </DialogContent>
    </Dialog>
  );
}
