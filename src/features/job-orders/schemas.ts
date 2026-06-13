import { z } from "zod";

export const jobOrderPartSchema = z.object({
  part_name: z.string().min(1, "Part name is required").max(200),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0"),
  unit_price: z.coerce.number().min(0, "Unit price must be 0 or more"),
  inventory_item_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("")),
});

export const jobOrderFormSchema = z.object({
  customer_id: z.string().uuid("Please select a customer"),
  vehicle_id: z.string().uuid("Please select a vehicle"),
  unit_received_id: z.string().uuid().optional().or(z.literal("")),
  estimate_id: z.string().uuid().optional().or(z.literal("")),
  assigned_technician: z.string().max(200).optional().or(z.literal("")),
  date_started: z.string().optional().or(z.literal("")),
  date_completed: z.string().optional().or(z.literal("")),
  status: z.enum(["pending", "ongoing", "completed", "released"]),
  repair_description: z.string().max(2000).optional().or(z.literal("")),
  parts: z.array(jobOrderPartSchema),
});

export type JobOrderPartValues = z.infer<typeof jobOrderPartSchema>;
export type JobOrderFormValues = z.infer<typeof jobOrderFormSchema>;
