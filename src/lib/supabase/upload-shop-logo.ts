"use client";

import { createClient } from "@/lib/supabase/client";
import {
  getLogoExtension,
  normalizeLogoMimeType,
  validateLogoFile,
} from "@/lib/supabase/logo-file";
import { mapStorageError } from "@/lib/supabase/storage-errors";

export type LogoUploadResult =
  | { success: true; logoUrl: string }
  | { success: false; error: string };

export async function uploadShopLogoToStorage(
  shopId: string,
  file: File
): Promise<LogoUploadResult> {
  const validationError = validateLogoFile(file);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const supabase = createClient();
  const mimeType = normalizeLogoMimeType(file);
  const extension = getLogoExtension(mimeType);
  const path = `${shopId}/logo.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("shop-logos")
    .upload(path, file, {
      upsert: true,
      contentType: mimeType,
    });

  if (uploadError) {
    return { success: false, error: mapStorageError(uploadError.message) };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("shop-logos").getPublicUrl(path);

  return {
    success: true,
    logoUrl: `${publicUrl}?v=${Date.now()}`,
  };
}

export async function removeShopLogoFromStorage(
  shopId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = createClient();

  const { data: files, error: listError } = await supabase.storage
    .from("shop-logos")
    .list(shopId);

  if (listError) {
    return { success: false, error: mapStorageError(listError.message) };
  }

  if (files?.length) {
    const paths = files.map((file) => `${shopId}/${file.name}`);
    const { error: removeError } = await supabase.storage
      .from("shop-logos")
      .remove(paths);

    if (removeError) {
      return { success: false, error: mapStorageError(removeError.message) };
    }
  }

  return { success: true };
}
