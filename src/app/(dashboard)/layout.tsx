export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Shop } from "@/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const profile = profileData as Profile | null;
  let shopName: string | undefined;

  if (profile?.shop_id) {
    const { data: shopData } = await supabase
      .from("shops")
      .select("shop_name")
      .eq("id", profile.shop_id)
      .single();

    const shop = shopData as Pick<Shop, "shop_name"> | null;
    shopName = shop?.shop_name;
  }

  return (
    <DashboardShell profile={profile} shopName={shopName}>
      {children}
    </DashboardShell>
  );
}
