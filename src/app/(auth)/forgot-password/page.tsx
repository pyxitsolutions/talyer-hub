"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return (
    <Card className="border-border/60 shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Forgot password</CardTitle>
        <CardDescription>
          Password resets are handled by your shop owner or platform administrator.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <p>
          Email reset links are not available right now. Ask your{" "}
          <strong className="text-foreground">shop owner</strong> to reset your password in{" "}
          <strong className="text-foreground">Settings → Team</strong>.
        </p>
        <p>
          Shop owners should contact the platform administrator if they forgot their own
          password.
        </p>
        <p>
          After you sign in with the temporary password they send you, go to{" "}
          <strong className="text-foreground">Settings → Change Password</strong> to set
          your own password.
        </p>
      </CardContent>
      <CardFooter>
        <Link
          href="/login"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
