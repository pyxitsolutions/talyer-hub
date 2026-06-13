"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { formatCurrency } from "@/lib/utils";
import type { Customer, InventoryItem, RepairEstimate, Vehicle } from "@/types/database";
import {
  estimateFormSchema,
  type EstimateFormValues,
} from "../schemas";

interface EstimateFormProps {
  estimate?: RepairEstimate & {
    repair_estimate_items?: {
      part_name: string;
      quantity: number;
      unit_price: number;
      inventory_item_id: string | null;
    }[];
  };
  customers: Pick<Customer, "id" | "full_name" | "customer_number">[];
  vehicles: Vehicle[];
  inventory: Pick<
    InventoryItem,
    "id" | "part_name" | "part_number" | "quantity" | "selling_price"
  >[];
  onCustomerChange: (customerId: string) => void;
  onSubmit: (values: EstimateFormValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function EstimateForm({
  estimate,
  customers,
  vehicles,
  inventory,
  onCustomerChange,
  onSubmit,
  onCancel,
  isLoading = false,
}: EstimateFormProps) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<EstimateFormValues>({
    resolver: zodResolver(estimateFormSchema),
    defaultValues: {
      customer_id: estimate?.customer_id ?? "",
      vehicle_id: estimate?.vehicle_id ?? "",
      estimate_date:
        estimate?.estimate_date ?? new Date().toISOString().split("T")[0],
      chassis_number: estimate?.chassis_number ?? "",
      engine_number: estimate?.engine_number ?? "",
      problem_description: estimate?.problem_description ?? "",
      repair_description: estimate?.repair_description ?? "",
      recommendation: estimate?.recommendation ?? "",
      technician_name: estimate?.technician_name ?? "",
      labor_cost: estimate?.labor_cost ?? 0,
      items:
        estimate?.repair_estimate_items?.map((item) => ({
          part_name: item.part_name,
          quantity: Math.round(Number(item.quantity)),
          unit_price: Number(item.unit_price),
          inventory_item_id: item.inventory_item_id ?? "",
        })) ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const customerId = useWatch({ control, name: "customer_id" });
  const items = useWatch({ control, name: "items" });
  const laborCost = useWatch({ control, name: "labor_cost" });

  useEffect(() => {
    if (customerId) {
      onCustomerChange(customerId);
    }
  }, [customerId, onCustomerChange]);

  const handleVehicleChange = (vehicleId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (vehicle) {
      setValue("chassis_number", vehicle.chassis_number ?? "");
      setValue("engine_number", vehicle.engine_number ?? "");
    }
  };

  const partsCost = (items ?? []).reduce(
    (sum, item) => sum + (Number(item?.quantity) || 0) * (Number(item?.unit_price) || 0),
    0
  );
  const totalCost = partsCost + (Number(laborCost) || 0);

  const handleInventorySelect = (index: number, inventoryId: string) => {
    const item = inventory.find((i) => i.id === inventoryId);
    if (item) {
      setValue(`items.${index}.part_name`, item.part_name);
      setValue(`items.${index}.unit_price`, item.selling_price);
      setValue(`items.${index}.inventory_item_id`, item.id);
    }
  };

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
                onValueChange={(value) => {
                  field.onChange(value);
                  handleVehicleChange(value);
                }}
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

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="estimate_date">Estimate Date *</Label>
          <Input id="estimate_date" type="date" {...register("estimate_date")} />
          {errors.estimate_date && (
            <p className="text-sm text-destructive">
              {errors.estimate_date.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="chassis_number">Chassis Number</Label>
          <Input id="chassis_number" {...register("chassis_number")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="engine_number">Engine Number</Label>
          <Input id="engine_number" {...register("engine_number")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="technician_name">Technician</Label>
        <Input id="technician_name" {...register("technician_name")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="problem_description">Problem Description</Label>
        <Textarea
          id="problem_description"
          rows={2}
          {...register("problem_description")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="repair_description">Repair Description</Label>
        <Textarea
          id="repair_description"
          rows={2}
          {...register("repair_description")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="recommendation">Recommendation</Label>
        <Textarea id="recommendation" rows={2} {...register("recommendation")} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Parts / Materials</Label>
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
            Add Item
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items added yet.</p>
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
                    value={items?.[index]?.inventory_item_id || ""}
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
                  <Input {...register(`items.${index}.part_name`)} />
                  {errors.items?.[index]?.part_name && (
                    <p className="text-xs text-destructive">
                      {errors.items[index]?.part_name?.message}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Qty *</Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    {...register(`items.${index}.quantity`)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Unit Price *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`items.${index}.unit_price`)}
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
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="labor_cost">Labor Cost</Label>
          <Input
            id="labor_cost"
            type="number"
            step="0.01"
            {...register("labor_cost")}
          />
        </div>
        <div className="space-y-2">
          <Label>Parts Cost</Label>
          <Input value={formatCurrency(partsCost)} disabled />
        </div>
        <div className="space-y-2">
          <Label>Total Cost</Label>
          <Input value={formatCurrency(totalCost)} disabled />
        </div>
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
            : estimate
              ? "Update Estimate"
              : "Create Estimate"}
        </Button>
      </div>
    </form>
  );
}
