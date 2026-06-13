import { z } from "zod";

export const expenseFormSchema = z.object({
  expense_date: z.string().min(1, "Date is required"),
  category: z.enum(
    [
      "shop_expenses",
      "food",
      "kitchen_supplies",
      "electricity",
      "water",
      "internet",
      "rent",
      "salary_expenses",
      "weekly_salary",
      "monthly_salary",
      "yearly_salary",
    ],
    { required_error: "Category is required" }
  ),
  description: z.string().min(1, "Description is required").max(500),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;
