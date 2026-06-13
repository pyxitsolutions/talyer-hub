"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getShopId } from "@/lib/auth";
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

const ALLOWED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const MAX_LOGO_SIZE = 2 * 1024 * 1024;

function getLogoExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    default:
      return "png";
  }
}

export async function uploadShopLogo(
  formData: FormData
): Promise<ActionResult<{ logo_url: string }>> {
  try {
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "Please choose a logo file." };
    }

    if (!ALLOWED_LOGO_TYPES.has(file.type)) {
      return {
        success: false,
        error: "Invalid file type. Use PNG, JPG, WEBP, or SVG.",
      };
    }

    if (file.size > MAX_LOGO_SIZE) {
      return { success: false, error: "Logo must be 2MB or smaller." };
    }

    const shopId = await getShopId();
    const supabase = await createClient();
    const extension = getLogoExtension(file.type);
    const path = `${shopId}/logo.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("shop-logos")
      .upload(path, buffer, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("shop-logos").getPublicUrl(path);

    const logoUrl = `${publicUrl}?v=${Date.now()}`;

    const { data, error } = await supabase
      .from("shops")
      .update({ logo_url: logoUrl })
      .eq("id", shopId)
      .select("logo_url")
      .single();

    if (error || !data) {
      return { success: false, error: error?.message ?? "Failed to save logo" };
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { success: true, data: { logo_url: data.logo_url! } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to upload logo",
    };
  }
}

export async function removeShopLogo(): Promise<ActionResult> {
  try {
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data: files, error: listError } = await supabase.storage
      .from("shop-logos")
      .list(shopId);

    if (listError) {
      return { success: false, error: listError.message };
    }

    if (files?.length) {
      const paths = files.map((file) => `${shopId}/${file.name}`);
      const { error: removeError } = await supabase.storage
        .from("shop-logos")
        .remove(paths);

      if (removeError) {
        return { success: false, error: removeError.message };
      }
    }

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
    const shopId = await getShopId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("shops")
      .select("*")
      .eq("id", shopId)
      .single();

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

    const shopId = await getShopId();
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
      .single();

    if (error) {
      return { success: false, error: error.message };
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
