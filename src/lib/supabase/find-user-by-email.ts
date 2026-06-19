import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export async function findAuthUserByEmail(email: string): Promise<User | null> {
  const supabase = createAdminClient();
  if (!supabase) {
    return null;
  }

  const normalized = email.trim().toLowerCase();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();

  if (profile?.id) {
    const { data, error } = await supabase.auth.admin.getUserById(profile.id);
    if (!error && data.user) {
      return data.user;
    }
  }

  let page = 1;
  const perPage = 200;

  while (page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error || !data.users.length) {
      return null;
    }

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalized
    );
    if (match) {
      return match;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }

  return null;
}
