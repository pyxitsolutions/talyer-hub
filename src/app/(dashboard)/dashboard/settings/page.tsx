import { redirect } from "next/navigation";

import { SettingsForm } from "@/features/settings/components/settings-form";
import { getSessionContext } from "@/lib/auth";

export default async function SettingsPage() {
  const context = await getSessionContext();

  if (!context) {
    redirect("/login");
  }

  const isOwner = !context.isSuperAdmin && context.roleName === "owner";

  return <SettingsForm isOwner={isOwner} />;
}
