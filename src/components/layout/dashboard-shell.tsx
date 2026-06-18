"use client";

import { useState, type ReactNode } from "react";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { ShopSetupBanner } from "@/components/shared/shop-setup-banner";
import { isShopNavLocked } from "@/lib/auth/routing";
import type { Profile, ShopStatus } from "@/types/database";

interface DashboardShellProps {
  children: ReactNode;
  profile: Profile | null;
  shopName?: string;
  shopStatus?: ShopStatus | null;
  isSuperAdmin?: boolean;
  roleName?: string;
}

export function DashboardShell({
  children,
  profile,
  shopName,
  shopStatus = null,
  isSuperAdmin = false,
  roleName = "owner",
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navLocked = isShopNavLocked(shopStatus, isSuperAdmin);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {!navLocked && (
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((prev) => !prev)}
          isSuperAdmin={isSuperAdmin}
          roleName={roleName}
        />
      )}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          profile={profile}
          shopName={shopName}
          shopStatus={shopStatus}
          isSuperAdmin={isSuperAdmin}
          roleName={roleName}
          navLocked={navLocked}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {!isSuperAdmin && !navLocked && <ShopSetupBanner profile={profile} />}
          {children}
        </main>
      </div>
    </div>
  );
}
