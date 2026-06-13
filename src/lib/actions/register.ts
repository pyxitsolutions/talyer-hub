"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";

interface SetupShopInput {
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  shopName: string;
  ownerName: string;
  contactNumber?: string;
  shopEmail?: string;
  address?: string;
}

export async function setupShop(input: SetupShopInput) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return { error: "Server configuration error. Missing service role key." };
  }

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .insert({
      shop_name: input.shopName,
      owner_name: input.ownerName,
      contact_number: input.contactNumber ?? null,
      email: input.shopEmail ?? input.email,
      address: input.address ?? null,
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
