"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InventoryItem } from "@/types/database";
import { inventoryFormSchema, type InventoryFormValues } from "../schemas";

interface InventoryFormProps {
  item?: InventoryItem;
  onSubmit: (values: InventoryFormValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function InventoryForm({
  item,
  onSubmit,
  onCancel,
  isLoading = false,
}: InventoryFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InventoryFormValues>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues: {
      part_number: item?.part_number ?? "",
      part_name: item?.part_name ?? "",
      category: item?.category ?? "",
      quantity: item?.quantity ?? 0,
      cost_price: item?.cost_price ?? 0,
      selling_price: item?.selling_price ?? 0,
      reorder_level: item?.reorder_level ?? 5,
      supplier: item?.supplier ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="part_number">Part Number *</Label>
          <Input id="part_number" {...register("part_number")} />
          {errors.part_number && (
            <p className="text-sm text-destructive">{errors.part_number.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="part_name">Part Name *</Label>
          <Input id="part_name" {...register("part_name")} />
          {errors.part_name && (
            <p className="text-sm text-destructive">{errors.part_name.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input id="category" placeholder="e.g. Filters, Brakes" {...register("category")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier">Supplier</Label>
          <Input id="supplier" {...register("supplier")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            step="1"
            min="0"
            disabled={!!item}
            {...register("quantity")}
          />
          {item && (
            <p className="text-xs text-muted-foreground">
              Use stock operations to change quantity after creation.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="reorder_level">Reorder Level</Label>
          <Input id="reorder_level" type="number" step="1" min="0" {...register("reorder_level")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cost_price">Cost Price</Label>
          <Input id="cost_price" type="number" step="0.01" {...register("cost_price")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="selling_price">Selling Price</Label>
          <Input id="selling_price" type="number" step="0.01" {...register("selling_price")} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : item ? "Update Item" : "Create Item"}
        </Button>
      </div>
    </form>
  );
}
