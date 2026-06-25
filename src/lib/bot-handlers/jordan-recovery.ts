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
import { rescheduleSubCaseFromDispoContext } from "@/src/lib/bot-v2/dispo-context";

export interface RecoveryDbContext {
  inspectionFindings: string | null;
  daysSinceAppointment: number | null;
  repName: string | null;
  consequenceLikelySurfaced: boolean | null;
  dispoNotes: string | null;
  dispoPrimaryObjection: string | null;
}

// The homeowner's own-words answers from the diagnosis walkthrough, formatted
// as a compact block for Jordan's recovery context. Returns null if none.
function formatWalkthroughAnswers(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as {
    steps?: Array<{ stepRef?: string; answer?: string }>;
    closingAnswer?: string | null;
  };
  const lines: string[] = [];
  for (const s of data.steps ?? []) {
    const answer = typeof s?.answer === "string" ? s.answer.trim() : "";
    if (!answer) continue;
    const ref = typeof s?.stepRef === "string" && s.stepRef.trim() ? `${s.stepRef.trim()}: ` : "";
    lines.push(`- ${ref}"${answer}"`);
  }
  const closing = typeof data.closingAnswer === "string" ? data.closingAnswer.trim() : "";
  if (closing) lines.push(`- Root issue (their words): "${closing}"`);
  if (lines.length === 0) return null;
  return `HOMEOWNER OWN-WORDS (typed during the diagnosis walkthrough):\n${lines.join("\n")}`;
}

// Load + derive the recovery context shared by all three Jordan missions.
export async function loadRecoveryContext(lead: Lead): Promise<RecoveryDbContext> {
  const lastInspection = await prisma.inspection.findFirst({
    where: { leadId: lead.id },
    orderBy: { createdAt: "desc" },
  });
  // Read the field the ACTIVE wizard actually writes: aiDiagnosisStructured
  // (the machine-readable Claude output reserved "for Jordan"), then the
  // human-readable description, then the legacy fields for old inspections
  // (audit #5). The old read used findingsNotes/diagnosis, which the modern
  // wizard never writes — so Jordan referenced nothing specific.
  const clinicalFindings =
    (lastInspection?.aiDiagnosisStructured
      ? JSON.stringify(lastInspection.aiDiagnosisStructured)
      : null) ??
    lastInspection?.aiDiagnosisDescription ??
    lastInspection?.findingsNotes ??
    (lastInspection?.diagnosis ? JSON.stringify(lastInspection.diagnosis) : null);

  // Premium revival fuel: what the homeowner typed IN THEIR OWN WORDS at each
  // step of the guided diagnosis walkthrough. Jordan can quote these back during
  // recovery ("you said it looked worse than you expected at the East Slope").
  const ownWords = formatWalkthroughAnswers(lastInspection?.homeownerWalkthroughAnswers);

  const inspectionFindings =
    [clinicalFindings, ownWords].filter(Boolean).join("\n\n") || null;
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

// Merge the system-authored recovery seed (inspection findings + prior objection)
// INTO whatever funnelConcerns the lead already carries — instead of skipping the
// seed whenever funnelConcerns is non-empty (the Bug-A defect). A demo-not-sold lead
// that arrived via the guide already has funnelConcerns (the guide's flagged
// concerns), so the old `if (!funnelConcerns)` guard dropped the dispo objection and
// Jordan opened generically. Merge rules:
//   - nothing to seed → return existing unchanged.
//   - no existing → return the seed object.
//   - existing is an array (e.g. guide concern list) → preserve it under `concerns`
//     and attach the recovery facts so the objection still reaches the model.
//   - existing is an object → fill priorObjection/inspectionFindings ONLY where
//     absent/empty (never clobber a guide- or model-authored value).
export function mergeFunnelConcernsSeed(
  existing: unknown[] | Record<string, unknown> | null | undefined,
  seed: { inspectionFindings?: string | null; priorObjection?: string | null },
): unknown[] | Record<string, unknown> | null {
  const inspectionFindings = seed.inspectionFindings ?? null;
  const priorObjection = seed.priorObjection ?? null;
  if (inspectionFindings === null && priorObjection === null) return existing ?? null;

  if (existing == null) return { inspectionFindings, priorObjection };

  if (Array.isArray(existing)) {
    return { concerns: existing, inspectionFindings, priorObjection };
  }

  const merged: Record<string, unknown> = { ...existing };
  if (priorObjection !== null && !merged.priorObjection) merged.priorObjection = priorObjection;
  if (inspectionFindings !== null && !merged.inspectionFindings) merged.inspectionFindings = inspectionFindings;
  return merged;
}

// rescheduleSubCase — derived from (stage + sr_dispo_context), ARCHITECTURE §8/§7.
// PRIMARY source is sr_dispo_context (the structured rep-set nuance): the dispo
// handler wrote no_show | door | soft | simple, and door→porched_door /
// soft→porched_soft. Prefer the webhook-supplied value (Sprint 8 customData),
// then the durable Lead.srDispoContext mirror, then fall back to the legacy
// rescheduleReason/notes heuristic for any lead disposed before sr_dispo_context.
export function deriveRescheduleSubCase(lead: Lead, srDispoContext?: string | null): string {
  const rawLead = lead as unknown as Record<string, unknown>;

  const ctx = srDispoContext ?? (rawLead.srDispoContext as string | null) ?? null;
  const fromContext = rescheduleSubCaseFromDispoContext(ctx);
  if (fromContext) return fromContext;

  // ── Legacy fallback: infer from rescheduleReason + outcome + notes ──
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
