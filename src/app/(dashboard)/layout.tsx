import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SessionRecovery } from "@/components/shared/session-recovery";
import { getSessionContext } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getSessionContext();

  if (!context) {
    return <SessionRecovery />;
  }

  return (
    <DashboardShell
      profile={context.profile}
      shopName={context.shop?.shop_name}
      shopStatus={context.shopStatus}
      isSuperAdmin={context.isSuperAdmin}
      roleName={context.roleName}
    >
      {children}
    </DashboardShell>
  );
}
