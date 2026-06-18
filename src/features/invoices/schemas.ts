import { z } from "zod";

export const invoiceItemSchema = z.object({
  inventory_item_id: z.string().optional().or(z.literal("")),
  part_name: z.string().min(1, "Part name is required"),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1"),
  unit_price: z.coerce.number().min(0, "Unit price must be 0 or greater"),
});

export const invoiceFormSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  vehicle_id: z.string().min(1, "Vehicle is required"),
  job_order_id: z.string().optional().or(z.literal("")),
  invoice_date: z.string().min(1, "Invoice date is required"),
  chassis_number: z.string().max(100).optional().or(z.literal("")),
  engine_number: z.string().max(100).optional().or(z.literal("")),
  repair_description: z.string().max(2000).optional().or(z.literal("")),
  recommendation: z.string().max(2000).optional().or(z.literal("")),
  parts_used: z.string().max(2000).optional().or(z.literal("")),
  labor_cost: z.coerce.number().min(0, "Labor cost must be 0 or greater"),
  technician_name: z.string().max(200).optional().or(z.literal("")),
  amount_paid: z.coerce.number().min(0, "Amount paid must be 0 or greater"),
  payment_method: z
    .enum(["cash", "card", "bank_transfer", "check", "other"])
    .optional()
    .or(z.literal("")),
  payment_reference: z.string().max(100).optional().or(z.literal("")),
  payer_account_name: z.string().max(200).optional().or(z.literal("")),
  items: z.array(invoiceItemSchema).min(0),
});

export const paymentUpdateSchema = z.object({
  amount_paid: z.coerce.number().min(0, "Amount paid must be 0 or greater"),
  payment_method: z
    .enum(["cash", "card", "bank_transfer", "check", "other"])
    .optional()
    .or(z.literal("")),
  payment_reference: z.string().max(100).optional().or(z.literal("")),
  payer_account_name: z.string().max(200).optional().or(z.literal("")),
});

export const invoiceCreateFormSchema = invoiceFormSchema.refine(
  (data) => !!data.job_order_id,
  {
    message: "Select a completed job order to create an invoice.",
    path: ["job_order_id"],
  }
);

export type InvoiceItemFormValues = z.infer<typeof invoiceItemSchema>;
export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
export type PaymentUpdateValues = z.infer<typeof paymentUpdateSchema>;
