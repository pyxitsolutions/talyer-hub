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
import { Textarea } from "@/components/ui/textarea";
import { UNIT_CATEGORIES } from "@/lib/constants";
import type { Customer, UnitReceived, Vehicle } from "@/types/database";
import {
  unitReceivedFormSchema,
  type UnitReceivedFormValues,
} from "../schemas";

interface UnitsReceivedFormProps {
  unit?: UnitReceived;
  customers: Pick<Customer, "id" | "full_name" | "customer_number">[];
  vehicles: Pick<Vehicle, "id" | "plate_number" | "brand" | "model" | "customer_id">[];
  onSubmit: (values: UnitReceivedFormValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function UnitsReceivedForm({
  unit,
  customers,
  vehicles,
  onSubmit,
  onCancel,
  isLoading = false,
}: UnitsReceivedFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<UnitReceivedFormValues>({
    resolver: zodResolver(unitReceivedFormSchema),
    defaultValues: {
      received_date: unit?.received_date ?? new Date().toISOString().split("T")[0],
      category: unit?.category ?? "pms",
      customer_id: unit?.customer_id ?? "none",
      vehicle_id: unit?.vehicle_id ?? "none",
      job_order_id: unit?.job_order_id ?? "",
      notes: unit?.notes ?? "",
    },
  });

  const selectedCustomerId = watch("customer_id");
  const filteredVehicles = selectedCustomerId
    ? vehicles.filter((v) => v.customer_id === selectedCustomerId)
    : vehicles;

  const handleFormSubmit = (values: UnitReceivedFormValues) => {
    onSubmit({
      ...values,
      customer_id: values.customer_id === "none" ? "" : values.customer_id,
      vehicle_id: values.vehicle_id === "none" ? "" : values.vehicle_id,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="received_date">Received Date *</Label>
          <Input id="received_date" type="date" {...register("received_date")} />
          {errors.received_date && (
            <p className="text-sm text-destructive">{errors.received_date.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Category *</Label>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.category && (
            <p className="text-sm text-destructive">{errors.category.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Customer</Label>
          <Controller
            name="customer_id"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.full_name} ({customer.customer_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label>Vehicle</Label>
          <Controller
            name="vehicle_id"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {filteredVehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.plate_number} — {vehicle.brand} {vehicle.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : unit ? "Update Record" : "Log Unit Received"}
        </Button>
      </div>
    </form>
  );
}
