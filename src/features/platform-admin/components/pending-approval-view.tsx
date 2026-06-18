"use client";

import { Clock3, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { clearSessionQueryCache } from "@/lib/query/session-cache";

export function PendingApprovalView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = createClient();

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    clearSessionQueryCache(queryClient);
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg items-center">
      <Card className="w-full">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <Clock3 className="h-6 w-6" />
          </div>
          <CardTitle>Waiting for approval</CardTitle>
          <CardDescription>
            Your registration is complete. After a platform administrator approves your
            shop, you will get a <strong>15-day free trial</strong> with full Basic
            access — no payment until you decide to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button variant="outline" onClick={() => void handleSignOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
