"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Customer, InventoryItem, RepairEstimate, Vehicle } from "@/types/database";
import { getVehiclesByCustomer } from "../actions";
import type { EstimateFormValues } from "../schemas";
import { EstimateForm } from "./estimate-form";

interface EstimateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimate?: RepairEstimate & {
    repair_estimate_items?: {
      part_name: string;
      quantity: number;
      unit_price: number;
      inventory_item_id: string | null;
    }[];
  };
  customers: Pick<Customer, "id" | "full_name" | "customer_number">[];
  inventory: Pick<
    InventoryItem,
    "id" | "part_name" | "part_number" | "quantity" | "selling_price"
  >[];
  onSubmit: (values: EstimateFormValues) => Promise<void>;
  isLoading?: boolean;
}

export function EstimateDialog({
  open,
  onOpenChange,
  estimate,
  customers,
  inventory,
  onSubmit,
  isLoading = false,
}: EstimateDialogProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const handleCustomerChange = useCallback(async (customerId: string) => {
    const result = await getVehiclesByCustomer(customerId);
    if (result.success) {
      setVehicles(result.data);
    }
  }, []);

  useEffect(() => {
    if (open && estimate?.customer_id) {
      handleCustomerChange(estimate.customer_id);
    }
  }, [open, estimate?.customer_id, handleCustomerChange]);

  const handleSubmit = async (values: EstimateFormValues) => {
    await onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {estimate ? "Edit Estimate" : "New Repair Estimate"}
          </DialogTitle>
          <DialogDescription>
            {estimate
              ? "Update estimate details and line items."
              : "Create a repair estimate with parts and labor costs."}
          </DialogDescription>
        </DialogHeader>
        <EstimateForm
          estimate={estimate}
          customers={customers}
          vehicles={vehicles}
          inventory={inventory}
          onCustomerChange={handleCustomerChange}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
}
