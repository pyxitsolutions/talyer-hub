"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DeleteDialog } from "@/components/shared/delete-dialog";
import {
  deactivateCustomer,
  deleteCustomer,
  getCustomerRemovalInfo,
  reactivateCustomer,
} from "@/features/customers/actions";
import type { Customer } from "@/types/database";

interface CustomerRemoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Pick<Customer, "id" | "full_name" | "is_active">;
  onSuccess: () => void;
}

function buildHistoryDescription(
  fullName: string,
  counts: {
    estimates: number;
    jobOrders: number;
    invoices: number;
    unitsReceived: number;
    vehiclesWithHistory: number;
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
  if (counts.vehiclesWithHistory > 0) {
    parts.push(
      `${counts.vehiclesWithHistory} vehicle${counts.vehiclesWithHistory === 1 ? "" : "s"} with service records`
    );
  }

  return `${fullName} has ${parts.join(", ")} linked. They will be hidden from new estimates and unit logs, and their vehicles will be deactivated too. Existing records stay intact.`;
}

function buildOpenEstimatesDescription(
  fullName: string,
  openEstimates: {
    estimate_number: string;
    status: string;
    vehicles: { plate_number: string } | null;
  }[]
) {
  const labels = openEstimates.map((estimate) => {
    const plate = estimate.vehicles?.plate_number ?? "unknown plate";
    return `${estimate.estimate_number} (${estimate.status}, ${plate})`;
  });

  return `${fullName} has open estimate(s): ${labels.join(", ")}. Finish the visit and release the unit before deactivating this customer.`;
}

export function CustomerRemoveDialog({
  open,
  onOpenChange,
  customer,
  onSuccess,
}: CustomerRemoveDialogProps) {
  const queryClient = useQueryClient();
  const isInactive = customer?.is_active === false;

  const { data: removalInfo, isLoading: infoLoading } = useQuery({
    queryKey: ["customer-removal-info", customer?.id, customer?.is_active],
    queryFn: async () => {
      const result = await getCustomerRemovalInfo(customer!.id);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: open && !!customer?.id && !isInactive,
    staleTime: 0,
  });

  const actionMutation = useMutation({
    mutationFn: async () => {
      if (!customer) {
        throw new Error("Customer details are not ready yet.");
      }

      if (isInactive) {
        const result = await reactivateCustomer(customer.id);
        if (!result.success) throw new Error(result.error);
        return "reactivated" as const;
      }

      if (!removalInfo) {
        throw new Error("Customer details are not ready yet.");
      }

      if (removalInfo.hasHistory) {
        if (!removalInfo.canDeactivate) {
          throw new Error(
            removalInfo.openEstimates.length > 0
              ? buildOpenEstimatesDescription(
                  customer.full_name,
                  removalInfo.openEstimates
                )
              : "This customer cannot be deactivated right now."
          );
        }

        const result = await deactivateCustomer(customer.id);
        if (!result.success) throw new Error(result.error);
        return "deactivated" as const;
      }

      const result = await deleteCustomer(customer.id);
      if (!result.success) throw new Error(result.error);
      return "deleted" as const;
    },
    onSuccess: (action) => {
      toast.success(
        action === "reactivated"
          ? "Customer reactivated successfully"
          : action === "deactivated"
            ? "Customer deactivated successfully"
            : "Customer deleted successfully"
      );
      if (customer?.id) {
        queryClient.removeQueries({
          queryKey: ["customer-removal-info", customer.id],
        });
      }
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!customer) {
    return null;
  }

  const waitingForInfo = open && !isInactive && (infoLoading || !removalInfo);
  const blockDeactivate =
    !isInactive && !!removalInfo?.hasHistory && !removalInfo.canDeactivate;

  const title = waitingForInfo
    ? "Remove Customer"
    : isInactive
      ? "Reactivate Customer"
      : blockDeactivate
        ? "Cannot Deactivate Customer"
        : removalInfo?.hasHistory
          ? "Deactivate Customer"
          : "Delete Customer";

  const description = waitingForInfo
    ? "Checking customer history..."
    : isInactive
      ? `Reactivate ${customer.full_name}? They and their vehicles will appear again when creating new records.`
      : blockDeactivate && removalInfo
        ? buildOpenEstimatesDescription(
            customer.full_name,
            removalInfo.openEstimates
          )
        : removalInfo?.hasHistory
          ? buildHistoryDescription(customer.full_name, removalInfo.historyCounts)
          : `Permanently delete ${customer.full_name}? This customer has no service history. Any registered vehicles without history will also be removed.`;

  const confirmLabel = waitingForInfo
    ? "Please wait"
    : isInactive
      ? "Reactivate"
      : blockDeactivate
        ? "Finish open estimates first"
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
      confirmDisabled={blockDeactivate}
      confirmVariant={
        waitingForInfo || isInactive || removalInfo?.hasHistory
          ? "default"
          : "destructive"
      }
    />
  );
}
