import { UNIT_LOG_JOB_ORDER_MAX_AGE_DAYS } from "@/lib/constants";

export type UnitJobOrderEligibility = "ready" | "linked" | "unavailable";

interface UnitLogRecord {
  created_at: string;
  received_date: string;
  job_order_id: string | null;
  vehicle_id: string | null;
}

export function getUnitLogCutoffDate(
  maxAgeDays = UNIT_LOG_JOB_ORDER_MAX_AGE_DAYS
): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);
  return cutoff.toISOString().split("T")[0];
}

export function buildLastClosedAtByVehicle(
  rows: { vehicle_id: string; updated_at: string }[]
): Map<string, string> {
  const map = new Map<string, string>();

  for (const row of rows) {
    if (!map.has(row.vehicle_id)) {
      map.set(row.vehicle_id, row.updated_at);
    }
  }

  return map;
}

export function isUnitLogEligibleForJobOrder(
  unit: UnitLogRecord,
  lastClosedAtByVehicle: Map<string, string>,
  cutoffDate = getUnitLogCutoffDate()
): boolean {
  if (unit.job_order_id || !unit.vehicle_id) {
    return false;
  }

  if (unit.received_date < cutoffDate) {
    return false;
  }

  const lastClosedAt = lastClosedAtByVehicle.get(unit.vehicle_id);
  if (!lastClosedAt) {
    return true;
  }

  return new Date(unit.created_at) > new Date(lastClosedAt);
}

export function getUnitJobOrderEligibility(
  unit: UnitLogRecord,
  lastClosedAtByVehicle: Map<string, string>,
  cutoffDate = getUnitLogCutoffDate()
): UnitJobOrderEligibility {
  if (unit.job_order_id) {
    return "linked";
  }

  if (isUnitLogEligibleForJobOrder(unit, lastClosedAtByVehicle, cutoffDate)) {
    return "ready";
  }

  return "unavailable";
}

export function unitJobOrderEligibilityLabel(
  eligibility: UnitJobOrderEligibility,
  jobOrderNumber?: string | null,
  jobOrderStatus?: string | null
): string {
  if (eligibility === "linked") {
    const statusLabel = jobOrderStatus
      ? jobOrderStatus.charAt(0).toUpperCase() + jobOrderStatus.slice(1)
      : "Linked";
    return jobOrderNumber
      ? `In use — ${jobOrderNumber} (${statusLabel})`
      : `In use (${statusLabel})`;
  }

  if (eligibility === "ready") {
    return "Ready for job order";
  }

  return "Not available — log unit again";
}
