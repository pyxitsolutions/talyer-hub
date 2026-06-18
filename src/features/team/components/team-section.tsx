"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { ShopTeamMember } from "../actions";
import { addCashier, addServiceAdvisor, getShopTeamMembers } from "../actions";
import { AddTeamMemberForm } from "./add-team-member-form";
import { ResetTeamMemberPasswordDialog } from "./reset-team-member-password-dialog";

const STAFF_ROLES = new Set(["service_advisor", "cashier"]);

export function TeamSection() {
  const queryClient = useQueryClient();
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [createdMemberName, setCreatedMemberName] = useState<string | null>(null);
  const [createdMemberRole, setCreatedMemberRole] = useState<string | null>(null);
  const [resetMember, setResetMember] = useState<ShopTeamMember | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["shop-team"],
    queryFn: async () => {
      const result = await getShopTeamMembers();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  function handleMemberAdded(fullName: string, password: string, roleLabel: string) {
    queryClient.invalidateQueries({ queryKey: ["shop-team"] });
    setCreatedPassword(password);
    setCreatedMemberName(fullName);
    setCreatedMemberRole(roleLabel);
    toast.success(`${roleLabel} added`);
  }

  function handlePasswordReset(fullName: string, roleLabel: string, password: string) {
    setCreatedPassword(password);
    setCreatedMemberName(fullName);
    setCreatedMemberRole(`${roleLabel} (password reset)`);
  }

  async function handleCopyPassword() {
    if (!createdPassword) return;

    try {
      await navigator.clipboard.writeText(createdPassword);
      toast.success("Password copied");
    } catch {
      toast.error("Could not copy password");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
        <CardDescription>
          Add service advisors or cashiers, or reset their password if they forgot it. Send
          each temporary password manually.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Loading team members...
                  </TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No team members found.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => {
                  const canResetPassword = STAFF_ROLES.has(member.role_name);

                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.full_name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        {ROLE_LABELS[member.role_name] ?? member.role_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.is_active ? "default" : "secondary"}>
                          {member.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(member.created_at)}</TableCell>
                      <TableCell className="text-right">
                        {canResetPassword ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setResetMember(member)}
                          >
                            <KeyRound className="mr-1 h-4 w-4" />
                            Reset password
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {createdPassword && createdMemberName && createdMemberRole && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm dark:bg-emerald-950/30">
            <p className="font-medium text-emerald-900 dark:text-emerald-200">
              {createdMemberName} — {createdMemberRole}.
            </p>
            <p className="mt-1 text-emerald-800 dark:text-emerald-300">
              Send this temporary password to them now:
            </p>
            <div className="mt-3 flex gap-2">
              <Input value={createdPassword} readOnly className="font-mono bg-background" />
              <Button type="button" variant="outline" size="icon" onClick={handleCopyPassword}>
                <Copy className="h-4 w-4" />
                <span className="sr-only">Copy password</span>
              </Button>
            </div>
          </div>
        )}

        <Tabs defaultValue="service_advisor" className="space-y-4">
          <TabsList>
            <TabsTrigger value="service_advisor">Service Advisor</TabsTrigger>
            <TabsTrigger value="cashier">Cashier</TabsTrigger>
          </TabsList>

          <TabsContent value="service_advisor">
            <AddTeamMemberForm
              title="Add service advisor"
              description="They can manage customers, estimates, job orders, unit logs, and reports."
              submitLabel="Add service advisor"
              onAdd={addServiceAdvisor}
              onSuccess={(member, password) =>
                handleMemberAdded(member.full_name, password, "Service advisor")
              }
            />
          </TabsContent>

          <TabsContent value="cashier">
            <AddTeamMemberForm
              title="Add cashier"
              description="They can manage invoices, payments, sales, customers, and reports."
              submitLabel="Add cashier"
              onAdd={addCashier}
              onSuccess={(member, password) =>
                handleMemberAdded(member.full_name, password, "Cashier")
              }
            />
          </TabsContent>
        </Tabs>
      </CardContent>

      <ResetTeamMemberPasswordDialog
        open={!!resetMember}
        onOpenChange={(open) => {
          if (!open) setResetMember(null);
        }}
        member={resetMember}
        onReset={(password) => {
          if (!resetMember) return;
          handlePasswordReset(
            resetMember.full_name,
            ROLE_LABELS[resetMember.role_name] ?? resetMember.role_name,
            password
          );
        }}
      />
    </Card>
  );
}
