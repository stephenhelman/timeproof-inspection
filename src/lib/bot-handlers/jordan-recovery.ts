// ── JORDAN RECOVERY CONTEXT — system-authored derivation (Sprint 5 Step 4) ───
//
// The SYSTEM-authored recovery fields Jordan reads (ARCHITECTURE §7): these are
// derived by APP CODE from the DB (statuses, tags, rep notes), never by the model,
// and written through the airtight authorship seam (writeSystemFields). They are
// injected into the runtime lead_context block as read-only context.
//
//   - affordabilityIsReal  — finance: true on a credit/finance decline.
//   - rescheduleSubCase     — reschedule: no_show | porched_door | porched_soft | simple.
//   - consequenceLikelySurfaced — derived from rep notes (problem + surfaced cost → true).
//   - daysSinceAppointment, repName — from the DB.

import { prisma } from "@/src/lib/prisma";
import type { Lead } from "@prisma/client";

export interface RecoveryDbContext {
  inspectionFindings: string | null;
  daysSinceAppointment: number | null;
  repName: string | null;
  consequenceLikelySurfaced: boolean | null;
  dispoNotes: string | null;
  dispoPrimaryObjection: string | null;
}

// Load + derive the recovery context shared by all three Jordan missions.
export async function loadRecoveryContext(lead: Lead): Promise<RecoveryDbContext> {
  const lastInspection = await prisma.inspection.findFirst({
    where: { leadId: lead.id },
    orderBy: { createdAt: "desc" },
  });
  const inspectionFindings =
    lastInspection?.findingsNotes ??
    (lastInspection?.diagnosis ? JSON.stringify(lastInspection.diagnosis) : null);
  const daysSinceAppointment = lastInspection?.createdAt
    ? Math.floor((Date.now() - lastInspection.createdAt.getTime()) / 86400000)
    : null;

  const rawLead = lead as unknown as Record<string, unknown>;
  const dispoNotes = (rawLead.dispoNotes as string | null) ?? null;
  const dispoPrimaryObjection = (rawLead.dispoPrimaryObjection as string | null) ?? null;

  let repName: string | null = null;
  if (lead.assignedUserId) {
    const user = await prisma.user.findUnique({
      where: { id: lead.assignedUserId },
      select: { name: true },
    });
    repName = user?.name ?? null;
  }

  return {
    inspectionFindings,
    daysSinceAppointment,
    repName,
    consequenceLikelySurfaced: deriveConsequenceLikelySurfaced(inspectionFindings, dispoNotes),
    dispoNotes,
    dispoPrimaryObjection,
  };
}

// consequenceLikelySurfaced — calibrates reschedule depth (ARCHITECTURE §7,
// kernel/07): a real problem + a surfaced cost in the rep notes → true (light
// touch); thin/generic notes → false (rebuild). Heuristic: substantive notes that
// name a problem AND a cost/consequence count as surfaced.
function deriveConsequenceLikelySurfaced(
  inspectionFindings: string | null,
  dispoNotes: string | null,
): boolean {
  if (!dispoNotes || dispoNotes.trim().length < 25) return false;
  const t = dispoNotes.toLowerCase();
  const hasProblem = /leak|damage|hail|stain|rot|crack|missing|sag|mold|water|wind/.test(t) || !!inspectionFindings;
  const hasConsequence = /cost|expensive|worse|spread|framing|interior|repair|replace|risk|grow|ceiling|deck/.test(t);
  return hasProblem && hasConsequence;
}

// rescheduleSubCase — set from the GHL trigger + tags + rep notes (ARCHITECTURE §7,
// kernel/07). Maps the dispo `rescheduleReason` / outcome to the four sub-cases.
export function deriveRescheduleSubCase(lead: Lead): string {
  const rawLead = lead as unknown as Record<string, unknown>;
  const reason = String(rawLead.rescheduleReason ?? "").toLowerCase();
  const notes = String(rawLead.dispoNotes ?? "").toLowerCase();
  const outcome = String(rawLead.revivalOutcome ?? rawLead.dispoOutcome ?? "").toLowerCase();

  // No human contact — the rep showed, nobody answered.
  if (/no.?show/.test(reason) || /no.?show/.test(outcome)) return "no_show";

  // Porched — the rep made contact at the door. A logistics deflection ("not home",
  // "wife isn't here", timing) is the soft version; a flat shut-down is porched_door.
  if (/porch/.test(reason) || /porch/.test(outcome)) {
    if (/not home|isn'?t here|wasn'?t here|bad time|timing|come back|busy/.test(notes)) return "porched_soft";
    return "porched_door";
  }

  // Homeowner-initiated reschedule — relationship intact, pure logistics.
  if (/cancel|homeowner|time_constraint|weather|conflict/.test(reason)) return "simple";

  return "simple";
}
