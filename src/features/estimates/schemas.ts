import { z } from "zod";

export const estimateItemSchema = z.object({
  part_name: z.string().min(1, "Part name is required").max(200),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1"),
  unit_price: z.coerce.number().min(0, "Unit price must be 0 or more"),
  inventory_item_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("")),
});

export const estimateFormSchema = z.object({
  customer_id: z.string().uuid("Please select a customer"),
  vehicle_id: z.string().uuid("Please select a vehicle"),
  estimate_date: z.string().min(1, "Date is required"),
  chassis_number: z.string().max(100).optional().or(z.literal("")),
  engine_number: z.string().max(100).optional().or(z.literal("")),
  problem_description: z.string().max(2000).optional().or(z.literal("")),
  repair_description: z.string().max(2000).optional().or(z.literal("")),
  recommendation: z.string().max(2000).optional().or(z.literal("")),
  technician_name: z.string().max(200).optional().or(z.literal("")),
  labor_cost: z.coerce.number().min(0, "Labor cost must be 0 or more"),
  items: z.array(estimateItemSchema),
}).superRefine((data, ctx) => {
  const partsCost = data.items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );
  if (partsCost + data.labor_cost <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Estimate total must be greater than zero",
      path: ["labor_cost"],
    });
  }
});

export type EstimateItemValues = z.infer<typeof estimateItemSchema>;
export type EstimateFormValues = z.infer<typeof estimateFormSchema>;
