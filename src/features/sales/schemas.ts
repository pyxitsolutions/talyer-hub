import { z } from "zod";

export const salesFormSchema = z.object({
  sale_date: z.string().min(1, "Date is required"),
  sale_type: z.enum(["parts", "materials", "labor"], {
    required_error: "Sale type is required",
  }),
  description: z.string().max(500).optional().or(z.literal("")),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  invoice_id: z.string().optional().or(z.literal("")),
});

export type SalesFormValues = z.infer<typeof salesFormSchema>;
