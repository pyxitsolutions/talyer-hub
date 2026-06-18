"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/types/database";
import {
  customerFormSchema,
  type CustomerFormValues,
} from "../schemas";

interface CustomerFormProps {
  customer?: Customer;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function CustomerForm({
  customer,
  onSubmit,
  onCancel,
  isLoading = false,
}: CustomerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      full_name: customer?.full_name ?? "",
      contact_number: customer?.contact_number ?? "",
      email: customer?.email ?? "",
      address: customer?.address ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
        Collect only information needed for service records. Your shop is responsible
        for handling customer data in accordance with the Data Privacy Act (R.A. 10173).
        Use a nickname or display name if you do not need a legal full name.
      </p>

      <div className="space-y-2">
        <Label htmlFor="full_name">Customer name</Label>
        <Input
          id="full_name"
          placeholder="Nickname or display name"
          {...register("full_name")}
        />
        {errors.full_name && (
          <p className="text-sm text-destructive">{errors.full_name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact_number">Contact number</Label>
        <Input
          id="contact_number"
          type="tel"
          placeholder="09XX XXX XXXX"
          {...register("contact_number")}
        />
        <p className="text-xs text-muted-foreground">
          Name or contact number — at least one is required.
        </p>
        {errors.contact_number && (
          <p className="text-sm text-destructive">
            {errors.contact_number.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email (optional)</Label>
        <Input id="email" type="email" {...register("email")} />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address (optional)</Label>
        <Textarea id="address" rows={3} {...register("address")} />
        {errors.address && (
          <p className="text-sm text-destructive">{errors.address.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : customer ? "Update Customer" : "Create Customer"}
        </Button>
      </div>
    </form>
  );
}
