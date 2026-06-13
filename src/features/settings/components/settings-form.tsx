"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  changePassword,
  getShopSettings,
  updateShopSettings,
  type PasswordFormValues,
  type ShopFormValues,
} from "../actions";

const shopFormSchema = z.object({
  shop_name: z.string().min(1, "Shop name is required").max(200),
  owner_name: z.string().min(1, "Owner name is required").max(200),
  contact_number: z.string().max(50).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
});

const passwordFormSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z.string().min(8, "Password must be at least 8 characters"),
    confirm_password: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export function SettingsForm() {
  const queryClient = useQueryClient();

  const { data: shop, isLoading } = useQuery({
    queryKey: ["shop-settings"],
    queryFn: async () => {
      const result = await getShopSettings();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const shopForm = useForm<ShopFormValues>({
    resolver: zodResolver(shopFormSchema),
    values: shop
      ? {
          shop_name: shop.shop_name,
          owner_name: shop.owner_name,
          contact_number: shop.contact_number ?? "",
          email: shop.email ?? "",
          address: shop.address ?? "",
        }
      : undefined,
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const updateShopMutation = useMutation({
    mutationFn: async (values: ShopFormValues) => {
      const result = await updateShopSettings(values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-settings"] });
      queryClient.invalidateQueries({ queryKey: ["shop"] });
      toast.success("Shop settings updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (values: PasswordFormValues) => {
      const result = await changePassword(values);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      passwordForm.reset();
      toast.success("Password changed successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your shop information and account security."
      />

      <Card>
        <CardHeader>
          <CardTitle>Shop Information</CardTitle>
          <CardDescription>Update your shop profile and contact details.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={shopForm.handleSubmit((values) =>
              updateShopMutation.mutate(values)
            )}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shop_name">Shop Name *</Label>
                <Input id="shop_name" {...shopForm.register("shop_name")} />
                {shopForm.formState.errors.shop_name && (
                  <p className="text-sm text-destructive">
                    {shopForm.formState.errors.shop_name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner_name">Owner Name *</Label>
                <Input id="owner_name" {...shopForm.register("owner_name")} />
                {shopForm.formState.errors.owner_name && (
                  <p className="text-sm text-destructive">
                    {shopForm.formState.errors.owner_name.message}
                  </p>
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact_number">Contact Number</Label>
                <Input id="contact_number" {...shopForm.register("contact_number")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...shopForm.register("email")} />
                {shopForm.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {shopForm.formState.errors.email.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" rows={3} {...shopForm.register("address")} />
            </div>
            <Button type="submit" disabled={updateShopMutation.isPending}>
              {updateShopMutation.isPending ? "Saving..." : "Save Shop Info"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={passwordForm.handleSubmit((values) =>
              changePasswordMutation.mutate(values)
            )}
            className="space-y-4 max-w-md"
          >
            <div className="space-y-2">
              <Label htmlFor="current_password">Current Password *</Label>
              <Input
                id="current_password"
                type="password"
                {...passwordForm.register("current_password")}
              />
              {passwordForm.formState.errors.current_password && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.current_password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_password">New Password *</Label>
              <Input
                id="new_password"
                type="password"
                {...passwordForm.register("new_password")}
              />
              {passwordForm.formState.errors.new_password && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.new_password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm Password *</Label>
              <Input
                id="confirm_password"
                type="password"
                {...passwordForm.register("confirm_password")}
              />
              {passwordForm.formState.errors.confirm_password && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.confirm_password.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? "Updating..." : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
