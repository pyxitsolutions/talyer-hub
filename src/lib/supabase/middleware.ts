import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  getPostLoginPath,
  getStatusLandingPath,
  isProtectedAppRoute,
  isShopStatusRoute,
  type RouteAccess,
} from "@/lib/auth/routing";
import { canAccessRoute } from "@/lib/rbac";
import type { RoleName, ShopPlan, ShopStatus } from "@/types/database";
import { isProRoute, shopHasProAccess } from "@/lib/plans";

function redirectWithSession(
  request: NextRequest,
  pathname: string,
  supabaseResponse: NextResponse
) {
  if (request.nextUrl.pathname === pathname) {
    return supabaseResponse;
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  redirectUrl.search = "";
  const redirectResponse = NextResponse.redirect(redirectUrl);

  for (const cookie of supabaseResponse.cookies.getAll()) {
    redirectResponse.cookies.set(cookie.name, cookie.value, {
      path: cookie.path,
      domain: cookie.domain,
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      maxAge: cookie.maxAge,
      sameSite: cookie.sameSite,
      secure: cookie.secure,
    });
  }

  return redirectResponse;
}

async function getUserRoleName(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  shopId: string | null
): Promise<RoleName> {
  if (!shopId) {
    return "owner";
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", userId)
    .eq("shop_id", shopId);

  if (error || !data?.length) {
    return "owner";
  }

  const roleNames = data
    .map((row) => {
      const roles = row.roles as { name: string } | { name: string }[] | null;
      if (Array.isArray(roles)) {
        return roles[0]?.name;
      }
      return roles?.name;
    })
    .filter((name): name is RoleName => typeof name === "string");

  if (roleNames.includes("owner")) {
    return "owner";
  }

  return roleNames[0] ?? "owner";
}

async function getProfileAccess(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<RouteAccess> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin, shop_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return {
      hasProfile: false,
      isSuperAdmin: false,
      shopStatus: null,
      shopPlan: null,
      shopId: null,
    };
  }

  if (profile.is_super_admin) {
    return {
      hasProfile: true,
      isSuperAdmin: true,
      shopStatus: null,
      shopPlan: null,
      shopId: profile.shop_id,
    };
  }

  if (!profile.shop_id) {
    return {
      hasProfile: true,
      isSuperAdmin: false,
      shopStatus: null,
      shopPlan: null,
      shopId: null,
    };
  }

  const { data: shop } = await supabase
    .from("shops")
    .select("status, plan")
    .eq("id", profile.shop_id)
    .maybeSingle();

  return {
    hasProfile: true,
    isSuperAdmin: false,
    shopStatus: (shop?.status as ShopStatus | undefined) ?? null,
    shopPlan: (shop?.plan as ShopPlan | undefined) ?? "basic",
    shopId: profile.shop_id,
  };
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/register");

  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/verify") ||
    pathname === "/privacy" ||
    pathname === "/terms";

  if (!user && !isAuthRoute && !isPublicRoute) {
    return redirectWithSession(request, "/login", supabaseResponse);
  }

  if (user) {
    const access = await getProfileAccess(supabase, user.id);

    if (!access.hasProfile) {
      if (isProtectedAppRoute(pathname)) {
        return redirectWithSession(request, "/register", supabaseResponse);
      }

      if (isAuthRoute) {
        return supabaseResponse;
      }
    } else if (isAuthRoute) {
      return redirectWithSession(
        request,
        getPostLoginPath(access),
        supabaseResponse
      );
    }

    if (access.hasProfile) {
      if (access.isSuperAdmin) {
        if (
          pathname.startsWith("/dashboard") &&
          !pathname.startsWith("/dashboard/admin")
        ) {
          return redirectWithSession(
            request,
            "/dashboard/admin/shops",
            supabaseResponse
          );
        }
      } else {
        if (pathname.startsWith("/dashboard/admin")) {
          return redirectWithSession(request, "/dashboard", supabaseResponse);
        }

        const statusPath = getStatusLandingPath(access);

        if (statusPath) {
          if (isProtectedAppRoute(pathname) && pathname !== statusPath) {
            return redirectWithSession(request, statusPath, supabaseResponse);
          }
        } else if (isShopStatusRoute(pathname)) {
          return redirectWithSession(request, "/dashboard", supabaseResponse);
        }

        if (
          pathname.startsWith("/dashboard") &&
          access.shopStatus === "active" &&
          access.shopId
        ) {
          const roleName = await getUserRoleName(supabase, user.id, access.shopId);
          if (!canAccessRoute(roleName, pathname) && pathname !== "/dashboard") {
            return redirectWithSession(request, "/dashboard", supabaseResponse);
          }
        }

        if (
          !shopHasProAccess(access.shopPlan) &&
          isProRoute(pathname)
        ) {
          return redirectWithSession(request, "/dashboard/upgrade", supabaseResponse);
        }
      }
    }
  }

  return supabaseResponse;
}
