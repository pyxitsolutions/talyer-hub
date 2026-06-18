"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DeleteDialog } from "@/components/shared/delete-dialog";
import {
  deactivateVehicle,
  deleteVehicle,
  getVehicleRemovalInfo,
  reactivateVehicle,
} from "@/features/vehicles/actions";
import type { Vehicle } from "@/types/database";

interface VehicleRemoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: Pick<Vehicle, "id" | "plate_number" | "is_active">;
  customerIsActive?: boolean;
  onSuccess: () => void;
}

function buildHistoryDescription(
  plateNumber: string,
  counts: {
    estimates: number;
    jobOrders: number;
    invoices: number;
    unitsReceived: number;
  }
) {
  const parts: string[] = [];
  if (counts.estimates > 0) {
    parts.push(`${counts.estimates} estimate${counts.estimates === 1 ? "" : "s"}`);
  }
  if (counts.jobOrders > 0) {
    parts.push(`${counts.jobOrders} job order${counts.jobOrders === 1 ? "" : "s"}`);
  }
  if (counts.invoices > 0) {
    parts.push(`${counts.invoices} invoice${counts.invoices === 1 ? "" : "s"}`);
  }
  if (counts.unitsReceived > 0) {
    parts.push(
      `${counts.unitsReceived} unit log${counts.unitsReceived === 1 ? "" : "s"}`
    );
  }

  return `Vehicle ${plateNumber} has ${parts.join(", ")} linked. It will be hidden from new estimates and unit logs, but existing records stay intact.`;
}

export function VehicleRemoveDialog({
  open,
  onOpenChange,
  vehicle,
  customerIsActive = true,
  onSuccess,
}: VehicleRemoveDialogProps) {
  const queryClient = useQueryClient();
  const isInactive = vehicle?.is_active === false;
  const canReactivate = isInactive && customerIsActive;

  const { data: removalInfo, isLoading: infoLoading } = useQuery({
    queryKey: ["vehicle-removal-info", vehicle?.id, vehicle?.is_active],
    queryFn: async () => {
      const result = await getVehicleRemovalInfo(vehicle!.id);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: open && !!vehicle?.id && (!isInactive || customerIsActive),
    staleTime: 0,
  });

  const actionMutation = useMutation({
    mutationFn: async () => {
      if (!vehicle) {
        throw new Error("Vehicle details are not ready yet.");
      }

      if (isInactive) {
        if (!customerIsActive) {
          throw new Error(
            "Reactivate the customer first before reactivating this vehicle."
          );
        }

        const result = await reactivateVehicle(vehicle.id);
        if (!result.success) throw new Error(result.error);
        return "reactivated" as const;
      }

      if (!removalInfo) {
        throw new Error("Vehicle details are not ready yet.");
      }

      if (removalInfo.hasHistory) {
        if (!removalInfo.canDeactivate) {
          throw new Error(
            removalInfo.openEstimateNumber
              ? `This vehicle has open estimate ${removalInfo.openEstimateNumber}. Finish the visit and release the unit before deactivating.`
              : "This vehicle cannot be deactivated right now."
          );
        }

        const result = await deactivateVehicle(vehicle.id);
        if (!result.success) throw new Error(result.error);
        return "deactivated" as const;
      }

      const result = await deleteVehicle(vehicle.id);
      if (!result.success) throw new Error(result.error);
      return "deleted" as const;
    },
    onSuccess: (action) => {
      toast.success(
        action === "reactivated"
          ? "Vehicle reactivated successfully"
          : action === "deactivated"
            ? "Vehicle deactivated successfully"
            : "Vehicle deleted successfully"
      );
      if (vehicle?.id) {
        queryClient.removeQueries({
          queryKey: ["vehicle-removal-info", vehicle.id],
        });
      }
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!vehicle) {
    return null;
  }

  const hasOpenEstimate = !!removalInfo?.openEstimateNumber;
  const blockDeactivate =
    !isInactive &&
    !!removalInfo?.hasHistory &&
    removalInfo.canDeactivate === false &&
    hasOpenEstimate;

  const waitingForInfo =
    open &&
    ((canReactivate && (infoLoading || !removalInfo)) ||
      (!isInactive && (infoLoading || !removalInfo)));

  const title = waitingForInfo
    ? canReactivate
      ? "Reactivate Vehicle"
      : "Remove Vehicle"
    : isInactive && !customerIsActive
      ? "Cannot Reactivate Vehicle"
      : blockDeactivate
        ? "Cannot Deactivate Vehicle"
        : canReactivate
          ? "Reactivate Vehicle"
          : removalInfo?.hasHistory
            ? "Deactivate Vehicle"
            : "Delete Vehicle";

  const description = waitingForInfo
    ? "Checking vehicle history..."
    : isInactive && !customerIsActive
      ? `Vehicle ${vehicle.plate_number} belongs to an inactive customer. Reactivate the customer first — their vehicles will be restored automatically.`
      : blockDeactivate
        ? `Vehicle ${vehicle.plate_number} has open estimate ${removalInfo?.openEstimateNumber}. Finish the visit and release the unit before deactivating.`
        : canReactivate
          ? `Reactivate vehicle ${vehicle.plate_number}? It will appear again when creating estimates, unit logs, and other new records.`
          : removalInfo?.hasHistory
            ? buildHistoryDescription(vehicle.plate_number, removalInfo.historyCounts)
            : `Permanently delete vehicle ${vehicle.plate_number}? This vehicle has no service history and cannot be recovered.`;

  const confirmLabel = waitingForInfo
    ? "Please wait"
    : isInactive && !customerIsActive
      ? "Reactivate customer first"
      : blockDeactivate
        ? "Finish open estimate first"
        : canReactivate
          ? "Reactivate"
          : removalInfo?.hasHistory
            ? "Deactivate"
            : "Delete";

  return (
    <DeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      onConfirm={async () => {
        await actionMutation.mutateAsync();
      }}
      isLoading={actionMutation.isPending || waitingForInfo}
      confirmLabel={confirmLabel}
      confirmDisabled={(isInactive && !customerIsActive) || blockDeactivate}
      confirmVariant={
        waitingForInfo || canReactivate || removalInfo?.hasHistory
          ? "default"
          : "destructive"
      }
    />
  );
}
