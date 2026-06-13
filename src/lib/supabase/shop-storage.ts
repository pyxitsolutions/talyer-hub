import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export { mapStorageError } from "@/lib/supabase/storage-errors";

export async function getShopStorageClient() {
  const admin = createAdminClient();
  if (admin) {
    return admin;
  }

  return createClient();
}
