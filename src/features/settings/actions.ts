"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveShopId } from "@/lib/auth";
import { requireOwner } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { Shop } from "@/types/database";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

const shopFormSchema = z.object({
  shop_name: z.string().min(1, "Shop name is required").max(200),
  owner_name: z.string().min(1, "Owner name is required").max(200),
  contact_number: z.string().max(50).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
});

const passwordFormSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z.string().min(8, "Password must be at least 8 characters"),
    confirm_password: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export type ShopFormValues = z.infer<typeof shopFormSchema>;
export type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export async function saveShopLogoUrl(
  logoUrl: string
): Promise<ActionResult<{ logo_url: string }>> {
  try {
    const ownerCheck = await requireOwner();
    if (!ownerCheck.ok) {
      return { success: false, error: ownerCheck.error };
    }

    const shopId = ownerCheck.context.shopId!;

    if (!logoUrl.startsWith("http")) {
      return { success: false, error: "Invalid logo URL" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("shops")
      .update({ logo_url: logoUrl })
      .eq("id", shopId)
      .select("logo_url")
      .maybeSingle();

    if (error || !data?.logo_url) {
      return { success: false, error: error?.message ?? "Failed to save logo" };
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { success: true, data: { logo_url: data.logo_url } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save logo",
    };
  }
}

export async function clearShopLogoUrl(): Promise<ActionResult> {
  try {
    const ownerCheck = await requireOwner();
    if (!ownerCheck.ok) {
      return { success: false, error: ownerCheck.error };
    }

    const shopId = ownerCheck.context.shopId!;

    const supabase = await createClient();
    const { error } = await supabase
      .from("shops")
      .update({ logo_url: null })
      .eq("id", shopId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to remove logo",
    };
  }
}

export async function getShopSettings(): Promise<ActionResult<Shop>> {
  try {
    const shopId = await resolveShopId();
    if (!shopId) {
      return { success: false, error: "Shop not found" };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("shops")
      .select("*")
      .eq("id", shopId)
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: "Shop not found" };
    }

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch shop settings",
    };
  }
}

export async function updateShopSettings(
  values: ShopFormValues
): Promise<ActionResult<Shop>> {
  try {
    const parsed = shopFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const ownerCheck = await requireOwner();
    if (!ownerCheck.ok) {
      return { success: false, error: ownerCheck.error };
    }

    const shopId = ownerCheck.context.shopId!;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("shops")
      .update({
        shop_name: parsed.data.shop_name,
        owner_name: parsed.data.owner_name,
        contact_number: parsed.data.contact_number || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
      })
      .eq("id", shopId)
      .select()
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: error?.message ?? "Failed to update shop settings" };
    }

    revalidatePath("/dashboard/settings");
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update shop settings",
    };
  }
}

export async function changePassword(
  values: PasswordFormValues
): Promise<ActionResult> {
  try {
    const parsed = passwordFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return { success: false, error: "User not found" };
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.current_password,
    });

    if (signInError) {
      return { success: false, error: "Current password is incorrect" };
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.new_password,
    });

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to change password",
    };
  }
}
