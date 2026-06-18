interface LinkedJobOrder {
  job_order_number: string;
  status: string;
}

interface UnitReceivedLockInput {
  job_order_id?: string | null;
  job_orders?: LinkedJobOrder | null;
}

function formatLinkedJobOrderLabel(unit: UnitReceivedLockInput) {
  const jobOrderNumber = unit.job_orders?.job_order_number ?? "linked job order";
  const statusLabel = unit.job_orders?.status
    ? unit.job_orders.status.charAt(0).toUpperCase() +
      unit.job_orders.status.slice(1)
    : "Linked";

  return { jobOrderNumber, statusLabel };
}

export function getUnitReceivedDeleteLockReason(
  unit: UnitReceivedLockInput
): string | null {
  if (!unit.job_order_id) {
    return null;
  }

  const { jobOrderNumber, statusLabel } = formatLinkedJobOrderLabel(unit);

  return `Cannot delete: this unit log is linked to job order ${jobOrderNumber} (${statusLabel}). Remove or delete the job order first if allowed.`;
}

export function getUnitReceivedUpdateLockReason(
  unit: UnitReceivedLockInput
): string | null {
  if (!unit.job_order_id) {
    return null;
  }

  const { jobOrderNumber, statusLabel } = formatLinkedJobOrderLabel(unit);

  return `Cannot edit: this unit log is linked to job order ${jobOrderNumber} (${statusLabel}). Changes must be made through the job order.`;
}
