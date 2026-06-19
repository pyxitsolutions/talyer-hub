"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserByEmail } from "@/lib/supabase/find-user-by-email";
import { createClient } from "@/lib/supabase/server";

interface SetupShopInput {
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  shopName?: string;
  ownerName?: string;
  contactNumber?: string;
  shopEmail?: string;
  address?: string;
}

interface RegisterShopInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  contactNumber?: string;
  address?: string;
}

function resolveDefaultShopName(fullName: string, shopName?: string) {
  const trimmed = shopName?.trim();
  if (trimmed) return trimmed;
  return fullName.trim();
}

async function setupShop(input: SetupShopInput) {
  const supabase = createAdminClient();

  if (!supabase) {
    return { error: "Server configuration error. Missing service role key." };
  }

  const ownerName = input.ownerName?.trim() || input.fullName.trim();
  const shopName = resolveDefaultShopName(input.fullName, input.shopName);

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .insert({
      shop_name: shopName,
      owner_name: ownerName,
      contact_number: input.contactNumber ?? null,
      email: input.shopEmail ?? input.email,
      address: input.address ?? null,
      status: "pending",
      plan: "basic",
    })
    .select("id")
    .single();

  if (shopError || !shop) {
    return { error: shopError?.message ?? "Failed to create shop." };
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: input.userId,
    shop_id: shop.id,
    full_name: input.fullName,
    email: input.email,
    phone: input.phone ?? null,
    is_active: true,
    is_super_admin: false,
  });

  if (profileError) {
    return { error: profileError.message };
  }

  const { data: ownerRole, error: roleError } = await supabase
    .from("roles")
    .select("id")
    .eq("name", "owner")
    .single();

  if (roleError || !ownerRole) {
    return { error: roleError?.message ?? "Owner role not found." };
  }

  const { error: userRoleError } = await supabase.from("user_roles").insert({
    user_id: input.userId,
    role_id: ownerRole.id,
    shop_id: shop.id,
  });

  if (userRoleError) {
    return { error: userRoleError.message };
  }

  return { success: true, shopId: shop.id };
}

async function resolveUserId(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  input: RegisterShopInput,
  email: string
): Promise<{ userId: string } | { error: string }> {
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName.trim() },
  });

  if (authData.user) {
    return { userId: authData.user.id };
  }

  const alreadyRegistered =
    authError?.message?.toLowerCase().includes("already") ||
    authError?.message?.toLowerCase().includes("registered");

  if (!alreadyRegistered) {
    return { error: authError?.message ?? "Failed to create account." };
  }

  const existingUser = await findAuthUserByEmail(email);
  if (!existingUser) {
    return { error: "This email is already registered. Try signing in instead." };
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
    email_confirm: true,
    password: input.password,
    user_metadata: { full_name: input.fullName.trim() },
  });

  if (updateError) {
    return { error: updateError.message };
  }

  return { userId: existingUser.id };
}

export async function registerShopAccount(input: RegisterShopInput) {
  const supabase = createAdminClient();

  if (!supabase) {
    return {
      error:
        "Server configuration error. Add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart the dev server.",
    };
  }

  const email = input.email.trim().toLowerCase();
  const userResult = await resolveUserId(supabase, input, email);

  if ("error" in userResult) {
    return { error: userResult.error };
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("shop_id")
    .eq("id", userResult.userId)
    .maybeSingle();

  if (!existingProfile?.shop_id) {
    const shopResult = await setupShop({
      userId: userResult.userId,
      fullName: input.fullName,
      email,
      phone: input.phone,
      contactNumber: input.contactNumber,
      shopEmail: email,
      address: input.address,
    });

    if (shopResult.error) {
      return { error: shopResult.error };
    }
  }

  const sessionClient = await createClient();
  const { error: signInError } = await sessionClient.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (signInError) {
    return {
      error: `Account saved but sign-in failed: ${signInError.message}. Try signing in manually.`,
    };
  }

  return { success: true };
}
