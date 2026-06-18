import { z } from "zod";

export const customerFormSchema = z
  .object({
    full_name: z.string().max(200).optional().or(z.literal("")),
    contact_number: z.string().max(50).optional().or(z.literal("")),
    email: z
      .string()
      .email("Invalid email address")
      .optional()
      .or(z.literal("")),
    address: z.string().max(500).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const name = data.full_name?.trim();
    const contact = data.contact_number?.trim();

    if (!name && !contact) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a customer name or contact number",
        path: ["full_name"],
      });
    }
  });

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export function resolveCustomerFullName(values: CustomerFormValues): string {
  const name = values.full_name?.trim();
  if (name) {
    return name;
  }

  const contact = values.contact_number?.trim();
  if (contact) {
    return contact;
  }

  return "Customer";
}
