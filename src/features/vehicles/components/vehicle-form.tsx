"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

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
import type { Customer, Vehicle } from "@/types/database";
import { vehicleFormSchema, type VehicleFormValues } from "../schemas";

interface VehicleFormProps {
  vehicle?: Vehicle;
  customers: Pick<Customer, "id" | "full_name" | "customer_number">[];
  defaultCustomerId?: string;
  onSubmit: (values: VehicleFormValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function VehicleForm({
  vehicle,
  customers,
  defaultCustomerId,
  onSubmit,
  onCancel,
  isLoading = false,
}: VehicleFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      customer_id: vehicle?.customer_id ?? defaultCustomerId ?? "",
      plate_number: vehicle?.plate_number ?? "",
      brand: vehicle?.brand ?? "",
      model: vehicle?.model ?? "",
      unit: vehicle?.unit ?? "",
      year_model: vehicle?.year_model ?? "",
      chassis_number: vehicle?.chassis_number ?? "",
      engine_number: vehicle?.engine_number ?? "",
      color: vehicle?.color ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Customer *</Label>
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
        {errors.customer_id && (
          <p className="text-sm text-destructive">
            {errors.customer_id.message}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="plate_number">Plate Number *</Label>
          <Input id="plate_number" {...register("plate_number")} />
          {errors.plate_number && (
            <p className="text-sm text-destructive">
              {errors.plate_number.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <Input id="color" {...register("color")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="brand">Brand *</Label>
          <Input id="brand" {...register("brand")} />
          {errors.brand && (
            <p className="text-sm text-destructive">{errors.brand.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">Model *</Label>
          <Input id="model" {...register("model")} />
          {errors.model && (
            <p className="text-sm text-destructive">{errors.model.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="unit">Unit Type</Label>
          <Input id="unit" placeholder="e.g. Sedan, SUV" {...register("unit")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="year_model">Year Model</Label>
          <Input
            id="year_model"
            type="number"
            {...register("year_model")}
          />
          {errors.year_model && (
            <p className="text-sm text-destructive">
              {errors.year_model.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="chassis_number">Chassis Number</Label>
          <Input id="chassis_number" {...register("chassis_number")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="engine_number">Engine Number</Label>
          <Input id="engine_number" {...register("engine_number")} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : vehicle ? "Update Vehicle" : "Create Vehicle"}
        </Button>
      </div>
    </form>
  );
}
