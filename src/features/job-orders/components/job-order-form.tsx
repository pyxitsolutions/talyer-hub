"use client";

import { useEffect } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";

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
import { getAvailableUnitsForJobOrder } from "../actions";
import {
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
}: JobOrderFormProps) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<JobOrderFormValues>({
    resolver: zodResolver(jobOrderFormSchema),
    defaultValues: {
      customer_id: jobOrder?.customer_id ?? "",
      vehicle_id: jobOrder?.vehicle_id ?? "",
      unit_received_id: "",
      estimate_id: jobOrder?.estimate_id ?? "",
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

  const { fields, append, remove } = useFieldArray({
    control,
    name: "parts",
  });

  const customerId = useWatch({ control, name: "customer_id" });
  const vehicleId = useWatch({ control, name: "vehicle_id" });
  const parts = useWatch({ control, name: "parts" });

  const { data: availableUnits = [] } = useQuery({
    queryKey: ["units-for-job-order", vehicleId],
    queryFn: async () => {
      const result = await getAvailableUnitsForJobOrder(vehicleId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!vehicleId && !jobOrder,
  });

  useEffect(() => {
    if (customerId) {
      onCustomerChange(customerId);
    }
  }, [customerId, onCustomerChange]);

  useEffect(() => {
    if (!jobOrder) {
      setValue("unit_received_id", "");
    }
  }, [vehicleId, jobOrder, setValue]);

  const getUnitCategoryLabel = (category: string) =>
    UNIT_CATEGORIES.find((item) => item.value === category)?.label ?? category;

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Customer *</Label>
          <Controller
            name="customer_id"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  setValue("vehicle_id", "");
                  setValue("unit_received_id", "");
                }}
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
          {errors.vehicle_id && (
            <p className="text-sm text-destructive">
              {errors.vehicle_id.message}
            </p>
          )}
        </div>
      </div>

      {!jobOrder && (
        <div className="space-y-2">
          <Label>Unit Received *</Label>
          <Controller
            name="unit_received_id"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={!vehicleId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      vehicleId
                        ? "Select a logged unit"
                        : "Select a vehicle first"
                    }
                  />
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
          {vehicleId && availableUnits.length === 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              No current unit log is available for this vehicle. Log a fresh unit
              in{" "}
              <Link
                href="/dashboard/units-received"
                className="font-medium underline underline-offset-4"
              >
                Units Received
              </Link>{" "}
              for this visit before creating a job order.
            </p>
          )}
          {!vehicleId && (
            <p className="text-sm text-muted-foreground">
              Select a vehicle, then choose an open unit log from the current
              visit.
            </p>
          )}
          {errors.unit_received_id && (
            <p className="text-sm text-destructive">
              {errors.unit_received_id.message}
            </p>
          )}
        </div>
      )}

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

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
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
