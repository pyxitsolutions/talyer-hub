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
import type { SalesRecord } from "@/types/database";
import { salesFormSchema, type SalesFormValues } from "../schemas";

const SALE_TYPES = [
  { value: "parts", label: "Parts" },
  { value: "materials", label: "Materials" },
  { value: "labor", label: "Labor" },
] as const;

interface SalesFormProps {
  record?: SalesRecord;
  onSubmit: (values: SalesFormValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function SalesForm({
  record,
  onSubmit,
  onCancel,
  isLoading = false,
}: SalesFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SalesFormValues>({
    resolver: zodResolver(salesFormSchema),
    defaultValues: {
      sale_date: record?.sale_date ?? new Date().toISOString().split("T")[0],
      sale_type: record?.sale_type ?? "parts",
      description: record?.description ?? "",
      amount: record?.amount ?? 0,
      invoice_id: record?.invoice_id ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sale_date">Sale Date *</Label>
          <Input id="sale_date" type="date" {...register("sale_date")} />
          {errors.sale_date && (
            <p className="text-sm text-destructive">{errors.sale_date.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Sale Type *</Label>
          <Controller
            name="sale_type"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {SALE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.sale_type && (
            <p className="text-sm text-destructive">{errors.sale_type.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Amount *</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min="0"
          {...register("amount")}
        />
        {errors.amount && (
          <p className="text-sm text-destructive">{errors.amount.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={3} {...register("description")} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : record ? "Update Sale" : "Record Sale"}
        </Button>
      </div>
    </form>
  );
}
