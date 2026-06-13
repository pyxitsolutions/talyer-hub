import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: profileData } = await supabase
    .from("profiles")
    .select("full_name")
    .single();

  const profile = profileData as Pick<Profile, "full_name"> | null;

  return <DashboardView userName={profile?.full_name} />;
}
