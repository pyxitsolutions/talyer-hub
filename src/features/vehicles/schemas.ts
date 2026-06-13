import { z } from "zod";

export const vehicleFormSchema = z.object({
  customer_id: z.string().uuid("Please select a customer"),
  plate_number: z.string().min(1, "Plate number is required").max(20),
  brand: z.string().min(1, "Brand is required").max(100),
  model: z.string().min(1, "Model is required").max(100),
  unit: z.string().max(100).optional().or(z.literal("")),
  year_model: z
    .union([
      z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1),
      z.literal(""),
    ])
    .optional(),
  chassis_number: z.string().max(100).optional().or(z.literal("")),
  engine_number: z.string().max(100).optional().or(z.literal("")),
  color: z.string().max(50).optional().or(z.literal("")),
});

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>;
