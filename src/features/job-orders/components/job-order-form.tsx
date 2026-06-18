"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getEstimate } from "@/features/estimates/actions";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
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
  getJobOrderLinkedInvoice,
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
    invoices?: { invoice_number: string }[] | null;
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
  active?: boolean;
  dialogDataLoading?: boolean;
}

function getEmbeddedLinkedInvoice(
  invoices?: { invoice_number: string }[] | { invoice_number: string } | null
): { invoice_number: string } | null {
  if (!invoices) return null;
  if (Array.isArray(invoices)) {
    return invoices[0] ?? null;
  }
  return invoices.invoice_number ? invoices : null;
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
  active = true,
  dialogDataLoading = false,
}: JobOrderFormProps) {
  const isCreate = !jobOrder;
  const [isEstimatePrefillLoading, setIsEstimatePrefillLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
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
      labor_cost: Number(
        jobOrder?.labor_cost ?? jobOrder?.repair_estimates?.labor_cost ?? 0
      ),
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
  const status = useWatch({ control, name: "status" });
  const parts = useWatch({ control, name: "parts" });
  const laborCost = Number(useWatch({ control, name: "labor_cost" }) ?? 0);
  const isWorkFinished = status === "completed" || status === "released";

  const {
    data: approvedEstimates = [],
    isFetched: approvedEstimatesLoaded,
    isLoading: isLoadingApprovedEstimates,
    isFetching: isFetchingApprovedEstimates,
  } = useQuery({
      queryKey: ["approved-estimates-for-job-order"],
      queryFn: async () => {
        const result = await getApprovedEstimatesForJobOrder();
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
      enabled: isCreate && active,
      staleTime: 0,
      refetchOnMount: "always",
    });

  const {
    data: availableUnits = [],
    refetch: refetchAvailableUnits,
    isLoading: isLoadingAvailableUnits,
    isFetching: isFetchingAvailableUnits,
  } = useQuery({
    queryKey: ["units-for-job-order", vehicleId],
    queryFn: async () => {
      const result = await getAvailableUnitsForJobOrder(vehicleId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!vehicleId && isCreate && active,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (active && isCreate && vehicleId) {
      void refetchAvailableUnits();
    }
  }, [active, isCreate, vehicleId, refetchAvailableUnits]);

  const { data: linkedInvoiceCheck, isFetched: linkedInvoiceChecked } =
    useQuery({
      queryKey: ["job-order-linked-invoice", jobOrder?.id],
      queryFn: async () => {
        const result = await getJobOrderLinkedInvoice(jobOrder!.id);
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
      enabled: !isCreate && !!jobOrder?.id && active,
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    });

  const selectedEstimate = approvedEstimates.find(
    (estimate) => estimate.id === estimateId
  );
  const selectedEstimateId = selectedEstimate?.id;
  const selectedUnit = availableUnits.find((unit) => unit.id === unitReceivedId);
  const multipleUnits = availableUnits.length > 1;
  const lockedVehicleFromList = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const lockedCustomerLabel =
    selectedEstimate?.customers?.full_name ??
    customers.find((customer) => customer.id === customerId)?.full_name ??
    "";
  const lockedVehicleLabel = selectedEstimate?.vehicles
    ? `${selectedEstimate.vehicles.plate_number} — ${selectedEstimate.vehicles.brand} ${selectedEstimate.vehicles.model}`
    : lockedVehicleFromList
      ? `${lockedVehicleFromList.plate_number} — ${lockedVehicleFromList.brand} ${lockedVehicleFromList.model}`
      : "";

  const getUnitCategoryLabel = (category: string) =>
    UNIT_CATEGORIES.find((item) => item.value === category)?.label ?? category;

  useEffect(() => {
    if (customerId) {
      onCustomerChange(customerId);
    }
  }, [customerId, onCustomerChange]);

  useEffect(() => {
    if (!isCreate || !selectedEstimateId) return;

    const estimate = approvedEstimates.find(
      (item) => item.id === selectedEstimateId
    );
    if (!estimate) return;

    setValue("customer_id", estimate.customer_id, {
      shouldValidate: true,
    });
    setValue("vehicle_id", estimate.vehicle_id, {
      shouldValidate: true,
    });
    onCustomerChange(estimate.customer_id);
  }, [
    approvedEstimates,
    isCreate,
    onCustomerChange,
    selectedEstimateId,
    setValue,
  ]);

  useEffect(() => {
    if (!isCreate || !approvedEstimatesLoaded || !estimateId) return;

    if (approvedEstimates.some((estimate) => estimate.id === estimateId)) {
      return;
    }

    setValue("estimate_id", "", { shouldValidate: true });
    setValue("customer_id", "");
    setValue("vehicle_id", "");
    setValue("assigned_technician", "");
    setValue("repair_description", "");
    setValue("date_started", "");
    setValue("unit_received_id", "");
    setValue("labor_cost", 0);
    replace([]);
    toast.error(
      "Only approved estimates can be used for job orders. Approve the estimate first."
    );
  }, [
    approvedEstimates,
    approvedEstimatesLoaded,
    estimateId,
    isCreate,
    replace,
    setValue,
  ]);

  useEffect(() => {
    if (!isCreate || !selectedEstimateId) {
      setIsEstimatePrefillLoading(false);
      return;
    }

    let cancelled = false;
    setIsEstimatePrefillLoading(true);

    getEstimate(selectedEstimateId)
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          toast.error(result.error);
          return;
        }

        const estimate = result.data;
        if (estimate.status !== "approved") {
          toast.error("Only approved estimates can be used for job orders");
          setValue("estimate_id", "", { shouldValidate: true });
          setValue("labor_cost", 0);
          replace([]);
          return;
        }

        setValue("labor_cost", Number(estimate.labor_cost));
        setValue("customer_id", estimate.customer_id, { shouldValidate: true });
        setValue("vehicle_id", estimate.vehicle_id, { shouldValidate: true });
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
      })
      .finally(() => {
        if (!cancelled) {
          setIsEstimatePrefillLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isCreate, onCustomerChange, replace, selectedEstimateId, setValue]);

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
  const jobOrderTotal = partsTotal + laborCost;

  const hasUnitLog = availableUnits.length > 0;
  const unitSelected = !multipleUnits || !!unitReceivedId;
  const canSubmitCreate =
    !isCreate ||
    (!!selectedEstimateId &&
      !isEstimatePrefillLoading &&
      hasUnitLog &&
      unitSelected);
  const lockCustomerVehicle =
    (isCreate && !!selectedEstimate) || (!isCreate && !!jobOrder?.estimate_id);
  const linkedInvoice = linkedInvoiceChecked
    ? linkedInvoiceCheck
    : getEmbeddedLinkedInvoice(jobOrder?.invoices);
  const hasLinkedInvoice = Boolean(linkedInvoice?.invoice_number);
  const isReleased = !isCreate && jobOrder?.status === "released";
  const lockAllExceptStatus = !isCreate && hasLinkedInvoice && !isReleased;
  const lockPartsAndLabor =
    !isCreate && (isReleased || hasLinkedInvoice);
  const partsLaborLockMessage = hasLinkedInvoice
    ? `Parts and labor are locked because invoice ${linkedInvoice?.invoice_number ?? ""} is linked.`
    : "Parts and labor are locked because this job order is already released.";
  const isCheckingInvoiceLink = !isCreate && !!jobOrder?.id && !linkedInvoiceChecked;
  const statusOptions = hasLinkedInvoice
    ? JOB_ORDER_STATUSES.filter(
        (status) =>
          status.value === "completed" ||
          status.value === "released" ||
          status.value === jobOrder?.status
      )
    : JOB_ORDER_STATUSES;
  const canSubmitUpdate =
    linkedInvoiceChecked &&
    !isReleased &&
    (!hasLinkedInvoice || canRelease);
  const canSubmit = isCreate ? canSubmitCreate : canSubmitUpdate;

  const isLoadingApprovedEstimatesList =
    isCreate &&
    active &&
    (!approvedEstimatesLoaded ||
      isLoadingApprovedEstimates ||
      isFetchingApprovedEstimates);

  const isLoadingUnitsForVehicle =
    isCreate &&
    active &&
    !!vehicleId &&
    !!selectedEstimateId &&
    (isLoadingAvailableUnits || isFetchingAvailableUnits);

  const isCreateFormInitializing =
    isLoadingApprovedEstimatesList ||
    isEstimatePrefillLoading ||
    isLoadingUnitsForVehicle ||
    dialogDataLoading;

  const isFormInitializing = isCreate
    ? isCreateFormInitializing
    : isCheckingInvoiceLink;

  const formLoadingMessage = dialogDataLoading
    ? "Loading form data..."
    : isLoadingApprovedEstimatesList
      ? "Loading approved estimates..."
      : isEstimatePrefillLoading
        ? "Loading estimate details..."
        : isLoadingUnitsForVehicle
          ? "Loading unit logs..."
          : isCheckingInvoiceLink
            ? "Checking invoice link..."
            : "Loading...";

  const isFormDisabled = isFormInitializing || isLoading;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="relative">
        {isFormInitializing && (
          <div
            className="absolute inset-0 z-10 flex min-h-[12rem] items-center justify-center rounded-lg bg-background/80"
            aria-hidden="false"
          >
            <LoadingSpinner label={formLoadingMessage} />
          </div>
        )}
        <fieldset
          disabled={isFormDisabled}
          className="min-w-0 space-y-6 border-0 p-0 m-0 disabled:pointer-events-none disabled:opacity-60"
        >
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
          {approvedEstimatesLoaded && approvedEstimates.length === 0 && (
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

      {lockAllExceptStatus && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Invoice linked — job order is locked</p>
            <p className="mt-1">
              Only status can be changed (Completed or Released).{" "}
              {canRelease
                ? "Invoice is paid — set status to Released and click Update."
                : "Record full payment on the invoice before releasing the unit."}
            </p>
          </div>
        </div>
      )}

      {isCreate && selectedEstimate && (
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
          {lockCustomerVehicle ? (
            <Input value={lockedCustomerLabel} disabled readOnly />
          ) : (
            <Controller
              name="customer_id"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
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
          )}
          {errors.customer_id && (
            <p className="text-sm text-destructive">
              {errors.customer_id.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Vehicle *</Label>
          {lockCustomerVehicle ? (
            <Input
              value={lockedVehicleLabel || "Loading vehicle from estimate..."}
              disabled
              readOnly
            />
          ) : (
            <Controller
              name="vehicle_id"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!customerId}
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
          )}
          {errors.vehicle_id && (
            <p className="text-sm text-destructive">
              {errors.vehicle_id.message}
            </p>
          )}
          {lockCustomerVehicle && (
            <p className="text-sm text-muted-foreground">
              Customer and vehicle are taken from the selected estimate.
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
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  if (value === "completed" || value === "released") {
                    if (!watch("date_completed")) {
                      setValue(
                        "date_completed",
                        new Date().toISOString().split("T")[0]
                      );
                    }
                  } else {
                    setValue("date_completed", "");
                  }
                }}
                disabled={isReleased || isCheckingInvoiceLink}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem
                      key={status.value}
                      value={status.value}
                      disabled={
                        (status.value === "released" && !canRelease) ||
                        (hasLinkedInvoice &&
                          status.value !== "completed" &&
                          status.value !== "released")
                      }
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
          {!canRelease && releaseBlockMessage && !isReleased && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {releaseBlockMessage}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="date_started">Date Started</Label>
          <Input
            id="date_started"
            type="date"
            disabled={lockAllExceptStatus || isReleased}
            readOnly={lockAllExceptStatus || isReleased}
            {...register("date_started")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date_completed">Date Completed</Label>
          <Input
            id="date_completed"
            type="date"
            disabled={lockAllExceptStatus || isReleased || !isWorkFinished}
            readOnly={lockAllExceptStatus || isReleased || !isWorkFinished}
            {...register("date_completed")}
          />
          {!isWorkFinished && (
            <p className="text-xs text-muted-foreground">
              Auto-filled when status is set to Completed or Released.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="assigned_technician">Assigned Technician</Label>
        <Input
          id="assigned_technician"
          disabled={lockAllExceptStatus || isReleased}
          readOnly={lockAllExceptStatus || isReleased}
          {...register("assigned_technician")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="repair_description">Repair Description</Label>
        <Textarea
          id="repair_description"
          rows={3}
          disabled={lockAllExceptStatus || isReleased}
          readOnly={lockAllExceptStatus || isReleased}
          {...register("repair_description")}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Parts Used</Label>
          {!lockPartsAndLabor && (
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
          )}
        </div>

        {lockPartsAndLabor && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {partsLaborLockMessage}
          </p>
        )}

        {isCreate && isEstimatePrefillLoading && selectedEstimateId ? (
          <p className="text-sm text-muted-foreground">
            Loading parts from estimate...
          </p>
        ) : fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">No parts added yet.</p>
        ) : (
          <div
            className={`space-y-3 ${lockPartsAndLabor ? "pointer-events-none opacity-60" : ""}`}
          >
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
                    disabled={lockPartsAndLabor}
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
                  <Input
                    {...register(`parts.${index}.part_name`)}
                    disabled={lockPartsAndLabor}
                    readOnly={lockPartsAndLabor}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Qty *</Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    {...register(`parts.${index}.quantity`)}
                    disabled={lockPartsAndLabor}
                    readOnly={lockPartsAndLabor}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Unit Price *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`parts.${index}.unit_price`)}
                    disabled={lockPartsAndLabor}
                    readOnly={lockPartsAndLabor}
                  />
                </div>
                {!lockPartsAndLabor && (
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
                )}
              </div>
            ))}
          </div>
        )}

        <div
          className={`grid gap-4 sm:grid-cols-3 ${lockPartsAndLabor ? "pointer-events-none opacity-60" : ""}`}
        >
          <div className="space-y-2">
            <Label htmlFor="labor_cost">Labor Cost</Label>
            <Input
              id="labor_cost"
              type="number"
              step="0.01"
              min="0"
              disabled={lockPartsAndLabor}
              readOnly={lockPartsAndLabor}
              {...register("labor_cost")}
            />
            {errors.labor_cost && (
              <p className="text-sm text-destructive">
                {errors.labor_cost.message}
              </p>
            )}
            {isCreate && selectedEstimate && (
              <p className="text-xs text-muted-foreground">
                Pre-filled from estimate. Adjust if actual labor differs.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Parts Total</Label>
            <Input value={formatCurrency(partsTotal)} disabled readOnly />
          </div>
          <div className="space-y-2">
            <Label>Total</Label>
            <Input value={formatCurrency(jobOrderTotal)} disabled readOnly />
          </div>
        </div>
      </div>

      {isCreate && selectedEstimate && (
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

          {isLoadingUnitsForVehicle ? (
            <div className="rounded-lg border p-3">
              <LoadingSpinner
                size="sm"
                label="Loading unit logs..."
                className="py-4"
              />
            </div>
          ) : !hasUnitLog ? (
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
        </fieldset>
      </div>

      <div className="space-y-2 pt-2">
        {!isCreate && !canSubmitUpdate && !isLoading && !isFormInitializing && (
          <p className="text-right text-xs text-muted-foreground">
            {isReleased
              ? "Released job orders cannot be updated."
              : hasLinkedInvoice && !canRelease
                ? "Update is disabled until the linked invoice is fully paid."
                : null}
          </p>
        )}
        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={isLoading || !canSubmit || isFormInitializing}
          >
            {isLoading
              ? "Saving..."
              : jobOrder
                ? "Update Job Order"
                : "Create Job Order"}
          </Button>
        </div>
      </div>
    </form>
  );
}
