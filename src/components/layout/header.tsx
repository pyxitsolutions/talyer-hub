"use client";

import { LogOut, Settings, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ROLE_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { clearSessionQueryCache } from "@/lib/query/session-cache";
import type { Profile, ShopStatus } from "@/types/database";

function getLockedStatusLabel(shopStatus: ShopStatus | null | undefined) {
  if (shopStatus === "pending") {
    return "Waiting for platform approval";
  }
  if (shopStatus === "disabled") {
    return "Shop deactivated";
  }
  if (shopStatus === "rejected") {
    return "Registration rejected";
  }
  return "Access restricted";
}

interface HeaderProps {
  profile: Profile | null;
  shopName?: string;
  shopStatus?: ShopStatus | null;
  isSuperAdmin?: boolean;
  roleName?: string;
  navLocked?: boolean;
}

export function Header({
  profile,
  shopName,
  shopStatus = null,
  isSuperAdmin = false,
  roleName = "owner",
  navLocked = false,
}: HeaderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "U";

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
    <header className="dashboard-print-hide sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {!navLocked && <MobileNav isSuperAdmin={isSuperAdmin} roleName={roleName} />}

      {!navLocked ? (
        <div className="flex flex-1" />
      ) : (
        <div className="flex flex-1 flex-col">
          <p className="truncate text-sm font-semibold">{shopName ?? profile?.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {getLockedStatusLabel(shopStatus)}
          </p>
        </div>
      )}

      <div className="flex items-center gap-1">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.full_name} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{profile?.full_name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {isSuperAdmin
                    ? "Super Admin"
                    : roleName === "owner"
                      ? shopName ?? profile?.email
                      : ROLE_LABELS[roleName] ?? profile?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {!isSuperAdmin && !navLocked && (
              <>
                <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
