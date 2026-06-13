import { z } from "zod";

export const inventoryFormSchema = z.object({
  part_number: z.string().min(1, "Part number is required").max(100),
  part_name: z.string().min(1, "Part name is required").max(200),
  category: z.string().max(100).optional().or(z.literal("")),
  quantity: z.coerce.number().min(0, "Quantity must be 0 or greater"),
  cost_price: z.coerce.number().min(0, "Cost price must be 0 or greater"),
  selling_price: z.coerce.number().min(0, "Selling price must be 0 or greater"),
  reorder_level: z.coerce.number().min(0, "Reorder level must be 0 or greater"),
  supplier: z.string().max(200).optional().or(z.literal("")),
});

export const stockTransactionSchema = z.object({
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0"),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const stockAdjustmentSchema = z.object({
  new_quantity: z.coerce.number().min(0, "Quantity must be 0 or greater"),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type InventoryFormValues = z.infer<typeof inventoryFormSchema>;
export type StockTransactionValues = z.infer<typeof stockTransactionSchema>;
export type StockAdjustmentValues = z.infer<typeof stockAdjustmentSchema>;
