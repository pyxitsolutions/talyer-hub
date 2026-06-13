"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Profile } from "@/types/database";

interface ShopSetupBannerProps {
  profile: Profile | null;
}

export function ShopSetupBanner({ profile }: ShopSetupBannerProps) {
  if (!profile || profile.shop_id) {
    return null;
  }

  return (
    <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="space-y-3">
          <div>
            <p className="font-medium text-destructive">
              Shop not linked to your account
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your login exists, but no shop is linked to this profile yet.
              Create a shop account or ask an admin to link your profile in
              Supabase.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/register">Create a shop account</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
