import type { UserRole } from "@prisma/client";

// Role hierarchy — higher index = more authority
const ROLE_RANK: Record<UserRole, number> = {
  REP:            0,
  SETTER:         1,
  SETTER_MANAGER: 2,
  SALES_MANAGER:  3,
  REGIONAL:       4,
  ADMIN:          5,
};

export function hasRank(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

// ── Lead visibility ────────────────────────────────────────────────────────
// Returns true when the role can see ALL leads regardless of assignment.
export function canViewAllLeads(role: UserRole): boolean {
  return hasRank(role, "SALES_MANAGER");
}

// Returns true when this user can view a specific lead.
export function canViewLead(
  userId: string,
  role: UserRole,
  lead: { assignedUserId: string | null; setterUserId: string | null }
): boolean {
  if (canViewAllLeads(role)) return true;
  if (lead.assignedUserId === userId) return true;
  if (role === "SETTER" && lead.setterUserId === userId) return true;
  return false;
}

// ── Lead mutations ─────────────────────────────────────────────────────────
export function canEditLead(
  userId: string,
  role: UserRole,
  lead: { assignedUserId: string | null }
): boolean {
  if (hasRank(role, "SALES_MANAGER")) return true;
  return lead.assignedUserId === userId;
}

export function canDeleteLead(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canImportLeads(role: UserRole): boolean {
  return hasRank(role, "SALES_MANAGER");
}

export function canAssignLeads(role: UserRole): boolean {
  return hasRank(role, "SALES_MANAGER");
}

export function canCreateLead(role: UserRole): boolean {
  return hasRank(role, "REP");
}

// ── Inspection visibility ──────────────────────────────────────────────────
export function canViewInspection(
  userId: string,
  role: UserRole,
  inspection: { userId: string | null }
): boolean {
  if (hasRank(role, "SALES_MANAGER")) return true;
  return inspection.userId === userId;
}

export function canEditInspection(
  userId: string,
  role: UserRole,
  inspection: { userId: string | null }
): boolean {
  if (role === "ADMIN") return true;
  return inspection.userId === userId;
}

export function canDeleteInspection(
  userId: string,
  role: UserRole,
  inspection: { userId: string | null }
): boolean {
  if (role === "ADMIN") return true;
  return inspection.userId === userId;
}

// ── Admin panel ────────────────────────────────────────────────────────────
export function canAccessAdmin(role: UserRole): boolean {
  return hasRank(role, "REGIONAL");
}

// Manager-only views (pipeline health, revival queue) — SETTER_MANAGER and above
export function canAccessManagerViews(role: UserRole): boolean {
  return hasRank(role, "SETTER_MANAGER");
}

export function canManageUsers(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canResetPassword(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canViewWebhookLogs(role: UserRole): boolean {
  return hasRank(role, "REGIONAL");
}

// ── Teams / manager scoping ────────────────────────────────────────────────
export function canManageTeams(role: UserRole): boolean {
  return hasRank(role, "SETTER_MANAGER");
}

// Build a Prisma `where` clause that scopes leads to what `role`/`userId` can see.
// Pass into prisma.lead.findMany({ where: buildLeadScope(userId, role) }).
export function buildLeadScope(
  userId: string,
  role: UserRole,
  managerSubordinateIds?: string[]
): object {
  if (canViewAllLeads(role)) return {};

  if (role === "SETTER_MANAGER" && managerSubordinateIds?.length) {
    return {
      OR: [
        { assignedUserId: userId },
        { setterUserId: { in: managerSubordinateIds } },
        { assignedUserId: { in: managerSubordinateIds } },
      ],
    };
  }

  if (role === "SETTER") {
    return {
      OR: [
        { assignedUserId: userId },
        { setterUserId: userId },
      ],
    };
  }

  // REP
  return { assignedUserId: userId };
}
