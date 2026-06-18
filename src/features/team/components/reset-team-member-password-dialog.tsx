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
import { ROLE_LABELS } from "@/lib/constants";
import type { RoleName } from "@/types/database";
import { resetShopMemberPassword } from "../actions";

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

interface ResetTeamMemberPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    full_name: string;
    email: string;
    role_name: RoleName;
  } | null;
  onReset?: (password: string) => void;
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

export function ResetTeamMemberPasswordDialog({
  open,
  onOpenChange,
  member,
  onReset,
}: ResetTeamMemberPasswordDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [assignedPassword, setAssignedPassword] = useState<string | null>(null);

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
      setIsLoading(false);
    }
  }, [open, reset]);

  if (!member) {
    return null;
  }

  const roleLabel = ROLE_LABELS[member.role_name] ?? member.role_name;

  async function onSubmit(data: ResetPasswordForm) {
    setIsLoading(true);

    const result = await resetShopMemberPassword(member!.id, data.password);

    setIsLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    setAssignedPassword(data.password);
    onReset?.(data.password);
    toast.success("Password updated");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new temporary password for {member.full_name}. Send it to them manually
            so they can sign in and change it in Settings.
          </DialogDescription>
        </DialogHeader>

        {assignedPassword ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              Password updated for <strong>{member.full_name}</strong> ({roleLabel}).
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
              <p className="font-medium">{member.full_name}</p>
              <p className="text-muted-foreground">{member.email}</p>
              <p className="text-muted-foreground">{roleLabel}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="member_password">New password</Label>
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
              <Input
                id="member_password"
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
              <Label htmlFor="member_confirm_password">Confirm password</Label>
              <Input
                id="member_confirm_password"
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
