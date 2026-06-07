"use client";

import { useSession } from "next-auth/react";
import type { UserRole } from "@prisma/client";
import {
  hasRank,
  canViewAllLeads,
  canImportLeads,
  canAssignLeads,
  canCreateLead,
  canDeleteLead,
  canAccessAdmin,
  canAccessManagerViews,
  canManageUsers,
  canManageTeams,
  canViewWebhookLogs,
} from "./permissions";

export function usePermissions() {
  const { data: session } = useSession();
  const role = ((session?.user as { role?: string } | undefined)?.role ?? "REP") as UserRole;
  const userId = (session?.user as { id?: string } | undefined)?.id ?? "";

  return {
    userId,
    role,
    isAdmin:              role === "ADMIN",
    isAtLeastRegional:    hasRank(role, "REGIONAL"),
    isAtLeastManager:     hasRank(role, "SALES_MANAGER"),
    isAtLeastSetter:      hasRank(role, "SETTER"),
    canViewAllLeads:      canViewAllLeads(role),
    canImportLeads:       canImportLeads(role),
    canAssignLeads:       canAssignLeads(role),
    canCreateLead:        canCreateLead(role),
    canDeleteLead:        canDeleteLead(role),
    canAccessAdmin:       canAccessAdmin(role),
    canAccessManagerViews: canAccessManagerViews(role),
    canManageUsers:       canManageUsers(role),
    canManageTeams:       canManageTeams(role),
    canViewWebhookLogs:   canViewWebhookLogs(role),
  };
}
