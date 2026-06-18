"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertProPlan } from "@/lib/auth/plan-guard";
import { requireOwner } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { RoleName } from "@/types/database";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface ShopTeamMember {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  role_name: RoleName;
  created_at: string;
}

const addShopMemberSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(200),
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
});

export type AddShopMemberValues = z.infer<typeof addShopMemberSchema>;

type StaffRole = "service_advisor" | "cashier";

const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  service_advisor: "service advisor",
  cashier: "cashier",
};

async function findUserByEmail(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  const response = await fetch(
    `${url}/auth/v1/admin/users?filter=${encodeURIComponent(`email.eq.${email}`)}&per_page=1`,
    {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as { users?: { id: string; email?: string }[] };
  return body.users?.[0] ?? null;
}

export async function getShopTeamMembers(): Promise<ActionResult<ShopTeamMember[]>> {
  try {
    const planError = await assertProPlan();
    if (planError) {
      return planError;
    }

    const ownerCheck = await requireOwner();
    if (!ownerCheck.ok) {
      return { success: false, error: ownerCheck.error };
    }

    const shopId = ownerCheck.context.shopId!;
    const supabase = await createClient();

    const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, phone, is_active, created_at")
          .eq("shop_id", shopId)
          .order("created_at", { ascending: true }),
        supabase
          .from("user_roles")
          .select("user_id, roles(name)")
          .eq("shop_id", shopId),
      ]);

    if (profilesError) {
      return { success: false, error: profilesError.message };
    }

    if (rolesError) {
      return { success: false, error: rolesError.message };
    }

    const roleByUserId = new Map<string, RoleName>();
    for (const row of roles ?? []) {
      const rolesData = row.roles as { name: string } | { name: string }[] | null;
      const roleName = Array.isArray(rolesData)
        ? rolesData[0]?.name
        : rolesData?.name;
      if (typeof roleName === "string") {
        roleByUserId.set(row.user_id, roleName as RoleName);
      }
    }

    const members: ShopTeamMember[] = (profiles ?? []).map((profile) => ({
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      is_active: profile.is_active,
      role_name: roleByUserId.get(profile.id) ?? "owner",
      created_at: profile.created_at,
    }));

    return { success: true, data: members };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load team members",
    };
  }
}

async function addShopMember(
  values: AddShopMemberValues,
  role: StaffRole
): Promise<ActionResult<ShopTeamMember>> {
  const planError = await assertProPlan();
  if (planError) {
    return planError;
  }

  const parsed = addShopMemberSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const ownerCheck = await requireOwner();
  if (!ownerCheck.ok) {
    return { success: false, error: ownerCheck.error };
  }

  const shopId = ownerCheck.context.shopId!;
  const admin = createAdminClient();

  if (!admin) {
    return {
      success: false,
      error: "Server configuration error. Missing service role key.",
    };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const fullName = parsed.data.full_name.trim();
  const phone = parsed.data.phone?.trim() || null;
  const roleLabel = STAFF_ROLE_LABELS[role];

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, shop_id")
      .eq("id", existingUser.id)
      .maybeSingle();

    if (existingProfile?.shop_id && existingProfile.shop_id !== shopId) {
      return {
        success: false,
        error: "This email is already registered to another shop.",
      };
    }

    if (existingProfile?.shop_id === shopId) {
      const { data: existingRole } = await admin
        .from("user_roles")
        .select("roles(name)")
        .eq("user_id", existingUser.id)
        .eq("shop_id", shopId)
        .maybeSingle();

      const roles = existingRole?.roles as unknown as
        | { name: string }
        | { name: string }[]
        | null;
      const roleData = Array.isArray(roles) ? roles[0] : roles;
      if (roleData?.name === role) {
        return {
          success: false,
          error: `This email is already a ${roleLabel} in your shop.`,
        };
      }

      return {
        success: false,
        error: "This email is already linked to your shop with a different role.",
      };
    }

    return {
      success: false,
      error: "This email is already registered. Use a different email address.",
    };
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError || !authData.user) {
    return {
      success: false,
      error: authError?.message ?? `Failed to create ${roleLabel} account.`,
    };
  }

  const userId = authData.user.id;

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    shop_id: shopId,
    full_name: fullName,
    email,
    phone,
    is_active: true,
    is_super_admin: false,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return { success: false, error: profileError.message };
  }

  const { data: roleRecord, error: roleError } = await admin
    .from("roles")
    .select("id")
    .eq("name", role)
    .single();

  if (roleError || !roleRecord) {
    await admin.auth.admin.deleteUser(userId);
    return {
      success: false,
      error: roleError?.message ?? `${roleLabel} role not found.`,
    };
  }

  const { error: userRoleError } = await admin.from("user_roles").insert({
    user_id: userId,
    role_id: roleRecord.id,
    shop_id: shopId,
  });

  if (userRoleError) {
    await admin.auth.admin.deleteUser(userId);
    return { success: false, error: userRoleError.message };
  }

  revalidatePath("/dashboard/settings");

  return {
    success: true,
    data: {
      id: userId,
      full_name: fullName,
      email,
      phone,
      is_active: true,
      role_name: role,
      created_at: new Date().toISOString(),
    },
  };
}

export async function addServiceAdvisor(
  values: AddShopMemberValues
): Promise<ActionResult<ShopTeamMember>> {
  try {
    return await addShopMember(values, "service_advisor");
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to add service advisor",
    };
  }
}

export async function addCashier(
  values: AddShopMemberValues
): Promise<ActionResult<ShopTeamMember>> {
  try {
    return await addShopMember(values, "cashier");
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to add cashier",
    };
  }
}

const RESETTABLE_STAFF_ROLES: RoleName[] = ["service_advisor", "cashier"];

const resetShopMemberPasswordSchema = z.object({
  userId: z.string().uuid("Invalid team member"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function resetShopMemberPassword(
  userId: string,
  password: string
): Promise<
  ActionResult<{
    full_name: string;
    email: string;
    role_name: RoleName;
  }>
> {
  try {
    const planError = await assertProPlan();
    if (planError) {
      return planError;
    }

    const parsed = resetShopMemberPasswordSchema.safeParse({ userId, password });
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const ownerCheck = await requireOwner();
    if (!ownerCheck.ok) {
      return { success: false, error: ownerCheck.error };
    }

    if (parsed.data.userId === ownerCheck.context.userId) {
      return {
        success: false,
        error: "Use Change Password below to update your own password.",
      };
    }

    const shopId = ownerCheck.context.shopId!;
    const admin = createAdminClient();

    if (!admin) {
      return {
        success: false,
        error: "Server configuration error. Missing service role key.",
      };
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name, email, shop_id, is_super_admin")
      .eq("id", parsed.data.userId)
      .maybeSingle();

    if (profileError) {
      return { success: false, error: profileError.message };
    }

    if (!profile || profile.shop_id !== shopId) {
      return { success: false, error: "Team member not found in your shop." };
    }

    if (profile.is_super_admin) {
      return { success: false, error: "Cannot reset this account from here." };
    }

    const { data: userRole, error: roleError } = await admin
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", parsed.data.userId)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (roleError) {
      return { success: false, error: roleError.message };
    }

    const rolesData = userRole?.roles as unknown as
      | { name: string }
      | { name: string }[]
      | null;
    const roleData = Array.isArray(rolesData) ? rolesData[0] : rolesData;
    const roleName = roleData?.name as RoleName | undefined;

    if (!roleName || !RESETTABLE_STAFF_ROLES.includes(roleName)) {
      return {
        success: false,
        error: "Only service advisor and cashier passwords can be reset here.",
      };
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(
      parsed.data.userId,
      { password: parsed.data.password }
    );

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return {
      success: true,
      data: {
        full_name: profile.full_name,
        email: profile.email,
        role_name: roleName,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to reset team member password",
    };
  }
}
