import { redirect } from "next/navigation";

import { getAuthRedirectPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(await getAuthRedirectPath());
  }

  redirect("/login");
}
