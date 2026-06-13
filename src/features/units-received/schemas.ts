import { z } from "zod";

export const unitReceivedFormSchema = z.object({
  received_date: z.string().min(1, "Date is required"),
  category: z.enum(["pms", "minor_repair", "general_repair", "body_repair_paint"], {
    required_error: "Category is required",
  }),
  customer_id: z.string().optional().or(z.literal("")),
  vehicle_id: z.string().optional().or(z.literal("")),
  job_order_id: z.string().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type UnitReceivedFormValues = z.infer<typeof unitReceivedFormSchema>;
