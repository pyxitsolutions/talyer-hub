"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AddShopMemberValues, ShopTeamMember } from "../actions";

const addMemberSchema = z
  .object({
    full_name: z.string().trim().min(1, "Full name is required").max(200),
    email: z.string().trim().email("Please enter a valid email address"),
    phone: z.string().trim().max(50).optional().or(z.literal("")),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type AddMemberForm = z.infer<typeof addMemberSchema>;

function generateTemporaryPassword(length = 10) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)]!;
  const required = [pick(upper), pick(lower), pick(digits)];
  const rest = Array.from({ length: length - required.length }, () => pick(all));
  return [...required, ...rest].sort(() => Math.random() - 0.5).join("");
}

interface AddTeamMemberFormProps {
  title: string;
  description: string;
  submitLabel: string;
  onAdd: (values: AddShopMemberValues) => Promise<
    { success: true; data: ShopTeamMember } | { success: false; error: string }
  >;
  onSuccess: (member: ShopTeamMember, password: string) => void;
}

export function AddTeamMemberForm({
  title,
  description,
  submitLabel,
  onAdd,
  onSuccess,
}: AddTeamMemberFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AddMemberForm>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const addMutation = useMutation({
    mutationFn: async (values: AddMemberForm) => {
      const payload: AddShopMemberValues = {
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        password: values.password,
      };
      const result = await onAdd(payload);
      if (!result.success) throw new Error(result.error);
      return { member: result.data, password: values.password };
    },
    onSuccess: ({ member, password }) => {
      reset();
      onSuccess(member, password);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      onSubmit={handleSubmit((values) => addMutation.mutate(values))}
      className="space-y-4 rounded-lg border p-4"
    >
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${title}-full_name`}>Full name *</Label>
          <Input id={`${title}-full_name`} {...register("full_name")} />
          {errors.full_name && (
            <p className="text-sm text-destructive">{errors.full_name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${title}-email`}>Email *</Label>
          <Input id={`${title}-email`} type="email" {...register("email")} />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${title}-phone`}>Phone</Label>
        <Input id={`${title}-phone`} {...register("phone")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`${title}-password`}>Temporary password *</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={() => {
                const password = generateTemporaryPassword();
                setValue("password", password, { shouldValidate: true });
                setValue("confirmPassword", password, { shouldValidate: true });
              }}
            >
              Generate
            </Button>
          </div>
          <Input id={`${title}-password`} type="text" {...register("password")} />
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${title}-confirm_password`}>Confirm password *</Label>
          <Input
            id={`${title}-confirm_password`}
            type="text"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>
      </div>

      <Button type="submit" disabled={addMutation.isPending}>
        {addMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Adding...
          </>
        ) : (
          <>
            <UserPlus className="mr-2 h-4 w-4" />
            {submitLabel}
          </>
        )}
      </Button>
    </form>
  );
}
