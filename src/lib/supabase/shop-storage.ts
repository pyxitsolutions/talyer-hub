import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function getShopStorageClient() {
  const admin = createAdminClient();
  if (admin) {
    return admin;
  }

  return createClient();
}

export function mapStorageError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("bucket not found")) {
    return "Logo storage is not set up yet. Run supabase/migrations/004_shop_logos_storage.sql in the Supabase SQL Editor, then try again.";
  }

  if (
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("not authorized")
  ) {
    return "Logo upload was blocked by storage permissions. Ensure SUPABASE_SERVICE_ROLE_KEY is set in your environment, then redeploy.";
  }

  return message;
}
