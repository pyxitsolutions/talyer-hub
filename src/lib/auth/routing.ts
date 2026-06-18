import type { ShopPlan, ShopStatus } from "@/types/database";

export interface RouteAccess {
  hasProfile: boolean;
  isSuperAdmin: boolean;
  shopStatus: ShopStatus | null;
  shopPlan: ShopPlan | null;
  shopId: string | null;
}

export function getStatusLandingPath(access: RouteAccess): string | null {
  if (access.isSuperAdmin) {
    return null;
  }

  if (access.shopStatus === "pending") {
    return "/pending-approval";
  }

  if (access.shopStatus === "disabled") {
    return "/shop-disabled";
  }

  if (access.shopStatus === "rejected") {
    return "/shop-rejected";
  }

  return null;
}

export function getPostLoginPath(access: RouteAccess): string {
  if (!access.hasProfile) {
    return "/register";
  }

  if (access.isSuperAdmin) {
    return "/dashboard/admin/shops";
  }

  const statusPath = getStatusLandingPath(access);
  if (statusPath) {
    return statusPath;
  }

  return "/dashboard";
}

export function isProtectedAppRoute(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname === "/pending-approval" ||
    pathname === "/shop-disabled" ||
    pathname === "/shop-rejected"
  );
}

export function isShopStatusRoute(pathname: string) {
  return (
    pathname === "/pending-approval" ||
    pathname === "/shop-disabled" ||
    pathname === "/shop-rejected"
  );
}

export function isShopNavLocked(
  shopStatus: ShopStatus | null | undefined,
  isSuperAdmin: boolean
): boolean {
  if (isSuperAdmin) {
    return false;
  }

  return (
    shopStatus === "pending" ||
    shopStatus === "disabled" ||
    shopStatus === "rejected"
  );
}
