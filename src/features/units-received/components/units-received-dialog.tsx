"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Customer, UnitReceived, Vehicle } from "@/types/database";
import type { UnitReceivedFormValues } from "../schemas";
import { UnitsReceivedForm } from "./units-received-form";

interface UnitsReceivedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit?: UnitReceived;
  customers: Pick<Customer, "id" | "full_name" | "customer_number">[];
  vehicles: Pick<Vehicle, "id" | "plate_number" | "brand" | "model" | "customer_id">[];
  onSubmit: (values: UnitReceivedFormValues) => Promise<void>;
  isLoading?: boolean;
}

export function UnitsReceivedDialog({
  open,
  onOpenChange,
  unit,
  customers,
  vehicles,
  onSubmit,
  isLoading = false,
}: UnitsReceivedDialogProps) {
  const handleSubmit = async (values: UnitReceivedFormValues) => {
    await onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {unit ? "Edit Unit Received" : "Log Unit Received"}
          </DialogTitle>
          <DialogDescription>
            {unit
              ? "Update the unit received record below."
              : "Record a vehicle received for service."}
          </DialogDescription>
        </DialogHeader>
        <UnitsReceivedForm
          unit={unit}
          customers={customers}
          vehicles={vehicles}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
}
