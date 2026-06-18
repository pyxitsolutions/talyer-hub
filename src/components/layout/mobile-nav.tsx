"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ShopLogo } from "@/components/shared/shop-logo";
import { APP_NAME } from "@/lib/constants";
import { getVisibleNavItems } from "@/lib/nav-items";
import { useShop } from "@/lib/hooks/use-shop";
import { getNavIcon } from "@/lib/nav-icons";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  isSuperAdmin?: boolean;
  roleName?: string;
}

export function MobileNav({ isSuperAdmin = false, roleName = "owner" }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { shop } = useShop();
  const brandName = isSuperAdmin ? "Platform Admin" : shop?.shop_name ?? APP_NAME;
  const navItems = getVisibleNavItems(roleName, isSuperAdmin, shop?.plan ?? "basic");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b px-4 py-4 text-left">
          <SheetTitle className="flex items-center gap-2.5">
            <ShopLogo logoUrl={isSuperAdmin ? null : shop?.logo_url} alt={brandName} size="sm" />
            {brandName}
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-2">
          {navItems.map((item) => {
            const Icon = getNavIcon(item.icon);
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
