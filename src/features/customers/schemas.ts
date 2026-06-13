import { z } from "zod";

export const customerFormSchema = z.object({
  full_name: z.string().min(1, "Full name is required").max(200),
  contact_number: z.string().max(50).optional().or(z.literal("")),
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;
