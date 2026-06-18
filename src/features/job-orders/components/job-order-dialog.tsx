"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Customer, InventoryItem, JobOrder, Vehicle } from "@/types/database";
import { getEstimate } from "@/features/estimates/actions";
import { getJobOrderReleaseEligibility, getVehiclesByCustomer } from "../actions";
import type { JobOrderFormValues } from "../schemas";
import { JobOrderForm } from "./job-order-form";

interface JobOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobOrder?: Omit<JobOrder, "repair_estimates"> & {
    job_order_parts?: {
      part_name: string;
      quantity: number;
      unit_price: number;
      inventory_item_id: string | null;
    }[];
    repair_estimates?: JobOrder["repair_estimates"] | null;
  };
  customers: Pick<Customer, "id" | "full_name" | "customer_number">[];
  inventory: Pick<
    InventoryItem,
    "id" | "part_name" | "part_number" | "quantity" | "selling_price"
  >[];
  onSubmit: (values: JobOrderFormValues) => Promise<void>;
  isLoading?: boolean;
  initialEstimateId?: string;
  editLoading?: boolean;
  createFormKey?: number;
  dialogDataLoading?: boolean;
}

export function JobOrderDialog({
  open,
  onOpenChange,
  jobOrder,
  customers,
  inventory,
  onSubmit,
  isLoading = false,
  initialEstimateId,
  editLoading = false,
  createFormKey = 0,
  dialogDataLoading = false,
}: JobOrderDialogProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [canRelease, setCanRelease] = useState(true);
  const [releaseBlockMessage, setReleaseBlockMessage] = useState<string>();

  const handleCustomerChange = useCallback(async (customerId: string) => {
    const result = await getVehiclesByCustomer(customerId);
    if (result.success) {
      setVehicles(result.data);
    }
  }, []);

  useEffect(() => {
    if (open && jobOrder?.customer_id) {
      handleCustomerChange(jobOrder.customer_id);
    }
  }, [open, jobOrder?.customer_id, handleCustomerChange]);

  useEffect(() => {
    if (!open || !initialEstimateId || jobOrder) return;

    getEstimate(initialEstimateId).then((result) => {
      if (result.success && result.data.status === "approved") {
        handleCustomerChange(result.data.customer_id);
      }
    });
  }, [open, initialEstimateId, jobOrder, handleCustomerChange]);

  useEffect(() => {
    if (!open || !jobOrder?.id) {
      setCanRelease(true);
      setReleaseBlockMessage(undefined);
      return;
    }

    getJobOrderReleaseEligibility(jobOrder.id).then((result) => {
      if (result.success) {
        setCanRelease(result.data.canRelease);
        setReleaseBlockMessage(
          result.data.canRelease ? undefined : result.data.message
        );
      }
    });
  }, [open, jobOrder?.id]);

  const handleSubmit = async (values: JobOrderFormValues) => {
    await onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {jobOrder ? "Edit Job Order" : "New Job Order from Estimate"}
          </DialogTitle>
          <DialogDescription>
            {jobOrder
              ? "Update job order details and parts used."
              : "Select an approved estimate, review the details, then save. A current unit log for that vehicle is required."}
          </DialogDescription>
        </DialogHeader>
        {editLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading job order...
          </p>
        ) : (
        <JobOrderForm
          key={jobOrder?.id ?? `create-${createFormKey}`}
          jobOrder={jobOrder}
          customers={customers}
          vehicles={vehicles}
          inventory={inventory}
          onCustomerChange={handleCustomerChange}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isLoading={isLoading}
          canRelease={canRelease}
          releaseBlockMessage={releaseBlockMessage}
          initialEstimateId={initialEstimateId}
          active={open}
          dialogDataLoading={dialogDataLoading}
        />
        )}
      </DialogContent>
    </Dialog>
  );
}
