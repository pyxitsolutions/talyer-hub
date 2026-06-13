import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  EstimateStatus,
  JobOrderStatus,
  PaymentStatus,
} from "@/types/database";

type StatusType = EstimateStatus | JobOrderStatus | PaymentStatus;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<
  StatusType,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  approved: {
    label: "Approved",
    className: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  rejected: {
    label: "Rejected",
    className: "border-transparent bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  pending: {
    label: "Pending",
    className: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  ongoing: {
    label: "Ongoing",
    className: "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  completed: {
    label: "Completed",
    className: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  released: {
    label: "Released",
    className: "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  unpaid: {
    label: "Unpaid",
    className: "border-transparent bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  partial: {
    label: "Partial",
    className: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  paid: {
    label: "Paid",
    className: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge
      variant="outline"
      className={cn("font-medium capitalize", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
