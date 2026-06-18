"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Ban, CheckCircle2, KeyRound, ShieldCheck, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DeleteDialog } from "@/components/shared/delete-dialog";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { ShopLogo } from "@/components/shared/shop-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SHOP_STATUSES } from "@/lib/constants";
import { PLAN_PRICING } from "@/lib/plans";
import { formatDate } from "@/lib/utils";
import type { ShopPlan, ShopStatus } from "@/types/database";
import {
  activateShop,
  approveShop,
  deleteRejectedShop,
  disableShop,
  getAdminShopCounts,
  getShopsForAdmin,
  rejectShop,
  setShopPlan,
  type ShopAdminRecord,
} from "../actions";
import { ResetOwnerPasswordDialog } from "./reset-owner-password-dialog";

type AdminTab = ShopStatus | "all";

function getStatusBadgeClass(status: ShopStatus) {
  if (status === "active") {
    return "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  }
  if (status === "pending") {
    return "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  }
  if (status === "rejected") {
    return "border-transparent bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  }
  return "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function getStatusLabel(status: ShopStatus) {
  return SHOP_STATUSES.find((item) => item.value === status)?.label ?? status;
}

function getPlanLabel(plan: ShopPlan) {
  return PLAN_PRICING[plan].label;
}

export function ShopsAdminPanel() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AdminTab>("pending");
  const [resetPasswordShop, setResetPasswordShop] = useState<ShopAdminRecord | null>(
    null
  );
  const [deleteShop, setDeleteShop] = useState<ShopAdminRecord | null>(null);

  const { data: counts } = useQuery({
    queryKey: ["admin-shops-counts"],
    queryFn: async () => {
      const result = await getAdminShopCounts();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: shops = [], isLoading, error } = useQuery({
    queryKey: ["admin-shops", tab],
    queryFn: async () => {
      const result = await getShopsForAdmin(tab);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const refreshAdminData = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-shops"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-shops-counts"] });
  };

  const approveMutation = useMutation({
    mutationFn: approveShop,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Shop approved successfully");
      refreshAdminData();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const rejectMutation = useMutation({
    mutationFn: rejectShop,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Registration rejected");
      refreshAdminData();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const disableMutation = useMutation({
    mutationFn: disableShop,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Shop deactivated");
      refreshAdminData();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const activateMutation = useMutation({
    mutationFn: activateShop,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Shop reactivated");
      refreshAdminData();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRejectedShop,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Rejected registration deleted");
      setDeleteShop(null);
      refreshAdminData();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const setPlanMutation = useMutation({
    mutationFn: ({ shopId, plan }: { shopId: string; plan: ShopPlan }) =>
      setShopPlan(shopId, plan),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Plan updated to ${getPlanLabel(result.data.plan)}`);
      refreshAdminData();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const columns = useMemo<ColumnDef<ShopAdminRecord>[]>(
    () => [
      {
        accessorKey: "shop_name",
        header: "Shop",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <ShopLogo
              logoUrl={row.original.logo_url}
              alt={row.original.shop_name}
              size="sm"
            />
            <div>
              <p className="font-medium">{row.original.shop_name}</p>
              <p className="text-xs text-muted-foreground">{row.original.owner_name}</p>
            </div>
          </div>
        ),
      },
      {
        id: "owner_account",
        header: "Owner Account",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.owner?.full_name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.owner?.email ?? row.original.email ?? "—"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "contact_number",
        header: "Contact",
        cell: ({ row }) => row.original.contact_number ?? row.original.owner?.phone ?? "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant="outline" className={getStatusBadgeClass(row.original.status)}>
            {getStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: "plan",
        header: "Plan",
        cell: ({ row }) => (
          <Badge variant={row.original.plan === "pro" ? "default" : "secondary"}>
            {getPlanLabel(row.original.plan ?? "basic")}
          </Badge>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Registered",
        cell: ({ row }) => formatDate(row.original.created_at),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const shop = row.original;
          const isPending = shop.status === "pending";
          const isActive = shop.status === "active";
          const isDisabled = shop.status === "disabled";
          const isRejected = shop.status === "rejected";
          const isBusy =
            approveMutation.isPending ||
            rejectMutation.isPending ||
            disableMutation.isPending ||
            activateMutation.isPending ||
            deleteMutation.isPending ||
            setPlanMutation.isPending;
          const canResetPassword = !!shop.owner?.id;

          return (
            <div className="flex justify-end gap-2">
              {canResetPassword && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => setResetPasswordShop(shop)}
                >
                  <KeyRound className="mr-1 h-4 w-4" />
                  Reset password
                </Button>
              )}
              {isPending && (
                <>
                  <Button
                    size="sm"
                    disabled={isBusy}
                    onClick={() => approveMutation.mutate(shop.id)}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => rejectMutation.mutate(shop.id)}
                  >
                    Reject
                  </Button>
                </>
              )}
              {isActive && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy || shop.plan === "basic"}
                    onClick={() =>
                      setPlanMutation.mutate({ shopId: shop.id, plan: "basic" })
                    }
                  >
                    Basic
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy || shop.plan === "pro"}
                    onClick={() => setPlanMutation.mutate({ shopId: shop.id, plan: "pro" })}
                  >
                    Pro
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isBusy}
                    onClick={() => disableMutation.mutate(shop.id)}
                  >
                    <Ban className="mr-1 h-4 w-4" />
                    Deactivate
                  </Button>
                </>
              )}
              {isRejected && (
                <>
                  <Button
                    size="sm"
                    disabled={isBusy}
                    onClick={() => approveMutation.mutate(shop.id)}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isBusy}
                    onClick={() => setDeleteShop(shop)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}
              {isDisabled && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => activateMutation.mutate(shop.id)}
                >
                  <ShieldCheck className="mr-1 h-4 w-4" />
                  Reactivate
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [activateMutation, approveMutation, deleteMutation, disableMutation, rejectMutation, setPlanMutation]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Admin"
        description="Review registrations, manage active shops, and keep rejected and deactivated shops separate."
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Store className="h-4 w-4" />
          {counts?.all ?? 0} total shops
        </div>
      </PageHeader>

      {error instanceof Error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error.message}
        </div>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value as AdminTab)}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({counts?.pending ?? 0})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({counts?.active ?? 0})
          </TabsTrigger>
          <TabsTrigger value="disabled">
            Deactivated ({counts?.disabled ?? 0})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({counts?.rejected ?? 0})
          </TabsTrigger>
          <TabsTrigger value="all">All ({counts?.all ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <DataTable
            columns={columns}
            data={shops}
            emptyMessage={isLoading ? "Loading shops..." : "No shops found for this tab."}
          />
        </TabsContent>
      </Tabs>

      {deleteShop && (
        <DeleteDialog
          open={!!deleteShop}
          onOpenChange={(open) => {
            if (!open) setDeleteShop(null);
          }}
          title="Delete rejected registration?"
          description={`This will permanently delete "${deleteShop.shop_name}" and remove the owner account. This cannot be undone.`}
          confirmLabel="Delete permanently"
          isLoading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteShop.id)}
        />
      )}

      {resetPasswordShop && (
        <ResetOwnerPasswordDialog
          open={!!resetPasswordShop}
          onOpenChange={(open) => {
            if (!open) setResetPasswordShop(null);
          }}
          shopId={resetPasswordShop.id}
          shopName={resetPasswordShop.shop_name}
          ownerName={resetPasswordShop.owner?.full_name}
          ownerEmail={resetPasswordShop.owner?.email}
        />
      )}
    </div>
  );
}
