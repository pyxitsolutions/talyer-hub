"use client";

import { useEffect } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";

import { getEstimate } from "@/features/estimates/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { JOB_ORDER_STATUSES, UNIT_CATEGORIES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Customer, InventoryItem, JobOrder, Vehicle } from "@/types/database";
import {
  getApprovedEstimatesForJobOrder,
  getAvailableUnitsForJobOrder,
} from "../actions";
import {
  jobOrderCreateFormSchema,
  jobOrderFormSchema,
  type JobOrderFormValues,
} from "../schemas";

interface JobOrderFormProps {
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
  vehicles: Vehicle[];
  inventory: Pick<
    InventoryItem,
    "id" | "part_name" | "part_number" | "quantity" | "selling_price"
  >[];
  onCustomerChange: (customerId: string) => void;
  onSubmit: (values: JobOrderFormValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  canRelease?: boolean;
  releaseBlockMessage?: string;
  initialEstimateId?: string;
}

function StepHeading({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {step}
      </div>
      <div>
        <p className="font-medium leading-none">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

export function JobOrderForm({
  jobOrder,
  customers,
  vehicles,
  inventory,
  onCustomerChange,
  onSubmit,
  onCancel,
  isLoading = false,
  canRelease = true,
  releaseBlockMessage,
  initialEstimateId,
}: JobOrderFormProps) {
  const isCreate = !jobOrder;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<JobOrderFormValues>({
    resolver: zodResolver(isCreate ? jobOrderCreateFormSchema : jobOrderFormSchema),
    defaultValues: {
      customer_id: jobOrder?.customer_id ?? "",
      vehicle_id: jobOrder?.vehicle_id ?? "",
      unit_received_id: "",
      estimate_id: jobOrder?.estimate_id ?? initialEstimateId ?? "",
      assigned_technician: jobOrder?.assigned_technician ?? "",
      date_started: jobOrder?.date_started ?? "",
      date_completed: jobOrder?.date_completed ?? "",
      status: jobOrder?.status ?? "pending",
      repair_description: jobOrder?.repair_description ?? "",
      parts:
        jobOrder?.job_order_parts?.map((part) => ({
          part_name: part.part_name,
          quantity: Math.round(Number(part.quantity)),
          unit_price: Number(part.unit_price),
          inventory_item_id: part.inventory_item_id ?? "",
        })) ?? [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "parts",
  });

  const estimateId = useWatch({ control, name: "estimate_id" });
  const unitReceivedId = useWatch({ control, name: "unit_received_id" });
  const customerId = useWatch({ control, name: "customer_id" });
  const vehicleId = useWatch({ control, name: "vehicle_id" });
  const parts = useWatch({ control, name: "parts" });

  const { data: approvedEstimates = [] } = useQuery({
    queryKey: ["approved-estimates-for-job-order"],
    queryFn: async () => {
      const result = await getApprovedEstimatesForJobOrder();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: isCreate,
  });

  const { data: availableUnits = [] } = useQuery({
    queryKey: ["units-for-job-order", vehicleId],
    queryFn: async () => {
      const result = await getAvailableUnitsForJobOrder(vehicleId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!vehicleId && isCreate,
  });

  const selectedEstimate = approvedEstimates.find(
    (estimate) => estimate.id === estimateId
  );
  const selectedUnit = availableUnits.find((unit) => unit.id === unitReceivedId);
  const multipleUnits = availableUnits.length > 1;

  const getUnitCategoryLabel = (category: string) =>
    UNIT_CATEGORIES.find((item) => item.value === category)?.label ?? category;

  useEffect(() => {
    if (customerId) {
      onCustomerChange(customerId);
    }
  }, [customerId, onCustomerChange]);

  useEffect(() => {
    if (!isCreate || !estimateId) return;

    let cancelled = false;

    getEstimate(estimateId).then((result) => {
      if (cancelled || !result.success) return;

      const estimate = result.data;
      setValue("customer_id", estimate.customer_id);
      setValue("vehicle_id", estimate.vehicle_id);
      setValue("assigned_technician", estimate.technician_name ?? "");
      setValue("repair_description", estimate.repair_description ?? "");
      setValue("date_started", new Date().toISOString().split("T")[0]);
      setValue("unit_received_id", "");
      replace(
        (estimate.repair_estimate_items ?? []).map((item) => ({
          part_name: item.part_name,
          quantity: Math.round(Number(item.quantity)),
          unit_price: Number(item.unit_price),
          inventory_item_id: item.inventory_item_id ?? "",
        }))
      );
      onCustomerChange(estimate.customer_id);
    });

    return () => {
      cancelled = true;
    };
  }, [estimateId, isCreate, onCustomerChange, replace, setValue]);

  useEffect(() => {
    if (!isCreate || !vehicleId) {
      setValue("unit_received_id", "");
      return;
    }

    if (availableUnits.length === 1) {
      setValue("unit_received_id", availableUnits[0].id);
      return;
    }

    if (
      unitReceivedId &&
      !availableUnits.some((unit) => unit.id === unitReceivedId)
    ) {
      setValue("unit_received_id", "");
    }
  }, [availableUnits, isCreate, setValue, unitReceivedId, vehicleId]);

  const handleInventorySelect = (index: number, inventoryId: string) => {
    const item = inventory.find((i) => i.id === inventoryId);
    if (item) {
      setValue(`parts.${index}.part_name`, item.part_name);
      setValue(`parts.${index}.unit_price`, item.selling_price);
      setValue(`parts.${index}.inventory_item_id`, item.id);
    }
  };

  const partsTotal = (parts ?? []).reduce(
    (sum, part) =>
      sum + (Number(part?.quantity) || 0) * (Number(part?.unit_price) || 0),
    0
  );

  const hasUnitLog = availableUnits.length > 0;
  const unitSelected = !multipleUnits || !!unitReceivedId;
  const canSubmitCreate =
    !isCreate || (!!estimateId && hasUnitLog && unitSelected);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {isCreate && (
        <section className="space-y-3">
          <StepHeading
            step={1}
            title="Select approved estimate"
            description="Customer, vehicle, and parts will be filled from the estimate."
          />
          <Controller
            name="estimate_id"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an approved estimate" />
                </SelectTrigger>
                <SelectContent>
                  {approvedEstimates.map((estimate) => (
                    <SelectItem key={estimate.id} value={estimate.id}>
                      {estimate.estimate_number} —{" "}
                      {estimate.customers?.full_name ?? "Unknown"} (
                      {estimate.vehicles?.plate_number ?? "No plate"} —{" "}
                      {estimate.vehicles?.brand} {estimate.vehicles?.model})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {approvedEstimates.length === 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              No approved estimates are available. Approve an estimate first, or
              use one that does not already have a job order.
            </p>
          )}
          {errors.estimate_id && (
            <p className="text-sm text-destructive">
              {errors.estimate_id.message}
            </p>
          )}
        </section>
      )}

      {!isCreate && jobOrder?.repair_estimates?.estimate_number && (
        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Source estimate: </span>
          <span className="font-medium">
            {jobOrder.repair_estimates.estimate_number}
          </span>
        </div>
      )}

      {isCreate && estimateId && (
        <section className="space-y-3">
          <StepHeading
            step={2}
            title="Review job order details"
            description="Adjust parts, dates, or technician before saving."
          />
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Customer *</Label>
          <Controller
            name="customer_id"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isCreate && !!estimateId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.full_name} ({customer.customer_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.customer_id && (
            <p className="text-sm text-destructive">
              {errors.customer_id.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Vehicle *</Label>
          <Controller
            name="vehicle_id"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={!customerId || (isCreate && !!estimateId)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.plate_number} — {vehicle.brand} {vehicle.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.vehicle_id && (
            <p className="text-sm text-destructive">
              {errors.vehicle_id.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Status *</Label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_ORDER_STATUSES.map((status) => (
                    <SelectItem
                      key={status.value}
                      value={status.value}
                      disabled={status.value === "released" && !canRelease}
                    >
                      {status.label}
                      {status.value === "released" && !canRelease
                        ? " (invoice must be paid)"
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {!canRelease && releaseBlockMessage && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {releaseBlockMessage}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="date_started">Date Started</Label>
          <Input id="date_started" type="date" {...register("date_started")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date_completed">Date Completed</Label>
          <Input
            id="date_completed"
            type="date"
            {...register("date_completed")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="assigned_technician">Assigned Technician</Label>
        <Input id="assigned_technician" {...register("assigned_technician")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="repair_description">Repair Description</Label>
        <Textarea
          id="repair_description"
          rows={3}
          {...register("repair_description")}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Parts Used</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                part_name: "",
                quantity: 1,
                unit_price: 0,
                inventory_item_id: "",
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Part
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">No parts added yet.</p>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid gap-2 rounded-lg border p-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-3">
                  <Label className="text-xs">From Inventory</Label>
                  <Select
                    value={parts?.[index]?.inventory_item_id || ""}
                    onValueChange={(value) =>
                      handleInventorySelect(index, value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventory.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.part_name} (Stock: {item.quantity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-3">
                  <Label className="text-xs">Part Name *</Label>
                  <Input {...register(`parts.${index}.part_name`)} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Qty *</Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    {...register(`parts.${index}.quantity`)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Unit Price *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`parts.${index}.unit_price`)}
                  />
                </div>
                <div className="flex items-end sm:col-span-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {partsTotal > 0 && (
          <p className="text-right text-sm text-muted-foreground">
            Parts total: {formatCurrency(partsTotal)}
          </p>
        )}
      </div>

      {isCreate && estimateId && (
        <section className="space-y-3">
          <StepHeading
            step={3}
            title="Unit log for this visit"
            description={
              selectedEstimate?.vehicles
                ? `Only unit logs for ${selectedEstimate.vehicles.plate_number} are eligible.`
                : "A current unit log in Units Received is required before saving."
            }
          />

          {!hasUnitLog ? (
            <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">No unit log available</p>
                <p className="mt-1">
                  Log the vehicle in{" "}
                  <Link
                    href="/dashboard/units-received"
                    className="font-medium underline underline-offset-4"
                  >
                    Units Received
                  </Link>{" "}
                  for this visit before creating a job order.
                </p>
              </div>
            </div>
          ) : multipleUnits ? (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">
                Multiple unit logs found for this vehicle. Select which visit log
                to link.
              </p>
              <div className="space-y-2">
                <Label>Unit Received *</Label>
                <Controller
                  name="unit_received_id"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a unit log" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUnits.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {formatDate(unit.received_date)} —{" "}
                            {getUnitCategoryLabel(unit.category)}
                            {unit.notes ? ` (${unit.notes})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          ) : (
            <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Unit log ready — will auto-link on save</p>
                <p className="mt-1">
                  {formatDate(availableUnits[0].received_date)} —{" "}
                  {getUnitCategoryLabel(availableUnits[0].category)}
                  {availableUnits[0].notes
                    ? ` (${availableUnits[0].notes})`
                    : ""}
                </p>
              </div>
            </div>
          )}

          {multipleUnits && selectedUnit && (
            <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Selected unit log</p>
                <p className="mt-1">
                  {formatDate(selectedUnit.received_date)} —{" "}
                  {getUnitCategoryLabel(selectedUnit.category)}
                  {selectedUnit.notes ? ` (${selectedUnit.notes})` : ""}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading || !canSubmitCreate}>
          {isLoading
            ? "Saving..."
            : jobOrder
              ? "Update Job Order"
              : "Create Job Order"}
        </Button>
      </div>
    </form>
  );
}
