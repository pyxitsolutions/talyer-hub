"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Customer, Vehicle } from "@/types/database";
import type { VehicleFormValues } from "../schemas";
import { VehicleForm } from "./vehicle-form";

interface VehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: Vehicle;
  customers: Pick<Customer, "id" | "full_name" | "customer_number">[];
  defaultCustomerId?: string;
  onSubmit: (values: VehicleFormValues) => Promise<void>;
  isLoading?: boolean;
}

export function VehicleDialog({
  open,
  onOpenChange,
  vehicle,
  customers,
  defaultCustomerId,
  onSubmit,
  isLoading = false,
}: VehicleDialogProps) {
  const handleSubmit = async (values: VehicleFormValues) => {
    await onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
          <DialogDescription>
            {vehicle
              ? "Update vehicle information below."
              : "Enter vehicle details to register a new unit."}
          </DialogDescription>
        </DialogHeader>
        <VehicleForm
          vehicle={vehicle}
          customers={customers}
          defaultCustomerId={defaultCustomerId}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
}
