"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, KeyRound, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetShopOwnerPassword } from "../actions";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

interface ResetOwnerPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shopId: string;
  shopName: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
}

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

export function ResetOwnerPasswordDialog({
  open,
  onOpenChange,
  shopId,
  shopName,
  ownerName,
  ownerEmail,
}: ResetOwnerPasswordDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [assignedPassword, setAssignedPassword] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<{
    ownerName: string;
    ownerEmail: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (!open) {
      reset();
      setAssignedPassword(null);
      setResetFor(null);
      setIsLoading(false);
    }
  }, [open, reset]);

  async function onSubmit(data: ResetPasswordForm) {
    setIsLoading(true);

    const result = await resetShopOwnerPassword(shopId, data.password);

    setIsLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    setAssignedPassword(data.password);
    setResetFor({
      ownerName: result.data.ownerName,
      ownerEmail: result.data.ownerEmail,
    });
    toast.success("Owner password updated");
  }

  async function handleCopyPassword() {
    if (!assignedPassword) return;

    try {
      await navigator.clipboard.writeText(assignedPassword);
      toast.success("Password copied");
    } catch {
      toast.error("Could not copy password");
    }
  }

  function handleGeneratePassword() {
    const password = generateTemporaryPassword();
    setValue("password", password, { shouldValidate: true });
    setValue("confirmPassword", password, { shouldValidate: true });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset owner password</DialogTitle>
          <DialogDescription>
            Set a new password for {shopName}. Send it to the owner through your usual
            channel. They can change it later in Settings.
          </DialogDescription>
        </DialogHeader>

        {assignedPassword && resetFor ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              Password updated for <strong>{resetFor.ownerName}</strong> (
              {resetFor.ownerEmail}).
            </div>
            <div className="space-y-2">
              <Label>New password</Label>
              <div className="flex gap-2">
                <Input value={assignedPassword} readOnly className="font-mono" />
                <Button type="button" variant="outline" size="icon" onClick={handleCopyPassword}>
                  <Copy className="h-4 w-4" />
                  <span className="sr-only">Copy password</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Copy this password and send it to the shop owner. This dialog will not show
                it again after you close it.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
              <p className="font-medium">{ownerName ?? "Shop owner"}</p>
              <p className="text-muted-foreground">{ownerEmail ?? "No email on file"}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">New password</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1 text-xs"
                  onClick={handleGeneratePassword}
                >
                  Generate
                </Button>
              </div>
              <Input
                id="password"
                type="text"
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
                type="text"
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Reset password
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
