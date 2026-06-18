"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { registerShopAccount } from "@/lib/actions/register";
import { PLAN_PRICING } from "@/lib/plans";

const registerSchema = z
  .object({
    fullName: z.string().min(2, "Full name is required"),
    email: z.string().email("Please enter a valid email address"),
    phone: z.string().optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    contactNumber: z.string().optional(),
    address: z.string().optional(),
    acceptedTerms: z.boolean().refine((value) => value, {
      message: "You must agree to the Privacy Policy and Terms of Service",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      acceptedTerms: false,
    },
  });

  async function onSubmit(data: RegisterForm) {
    setIsLoading(true);

    try {
      const result = await registerShopAccount({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
        phone: data.phone,
        contactNumber: data.contactNumber,
        address: data.address,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Account created! Waiting for admin approval.");
      router.refresh();
      router.replace("/pending-approval");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="border-border/60 shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Create your shop</CardTitle>
        <CardDescription>
          Create your shop account. After admin approval you get a{" "}
          <strong>15-day free trial</strong> — no payment upfront. Contact support to
          continue on Basic (₱{PLAN_PRICING.basic.price}/month) or Pro when you are ready.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Account details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  placeholder="John Martinez"
                  disabled={isLoading}
                  {...register("fullName")}
                />
                {errors.fullName && (
                  <p className="text-sm text-destructive">{errors.fullName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@shop.com"
                  autoComplete="email"
                  disabled={isLoading}
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1-555-0100"
                  disabled={isLoading}
                  {...register("phone")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isLoading}
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isLoading}
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Shop details (optional)
            </h3>
            <p className="text-sm text-muted-foreground">
              Shop name uses your full name for now. You can change it in Settings after
              approval.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactNumber">Contact number (optional)</Label>
                <Input
                  id="contactNumber"
                  type="tel"
                  placeholder="+1-555-0100"
                  disabled={isLoading}
                  {...register("contactNumber")}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Address (optional)</Label>
                <Input
                  id="address"
                  placeholder="123 Main Street, Auto City"
                  disabled={isLoading}
                  {...register("address")}
                />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-border/60 bg-muted/30 p-3">
            <Controller
              name="acceptedTerms"
              control={control}
              render={({ field }) => (
                <input
                  id="acceptedTerms"
                  type="checkbox"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                  disabled={isLoading}
                  className="mt-1 h-4 w-4 shrink-0 rounded border border-input accent-primary"
                />
              )}
            />
            <div className="space-y-1">
              <Label htmlFor="acceptedTerms" className="font-normal leading-snug">
                I agree to the{" "}
                <Link href="/privacy" className="text-primary hover:underline" target="_blank">
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link href="/terms" className="text-primary hover:underline" target="_blank">
                  Terms of Service
                </Link>
                , including processing of my personal data under the Data Privacy Act
                (R.A. 10173).
              </Label>
              {errors.acceptedTerms && (
                <p className="text-sm text-destructive">{errors.acceptedTerms.message}</p>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="animate-spin" />}
            Create shop account (pending approval)
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
