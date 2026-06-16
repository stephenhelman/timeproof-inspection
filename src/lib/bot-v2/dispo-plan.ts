// THE disposition routing table as DATA (ARCHITECTURE §8). The dispo route
// resolves an outcome to a DispoPlan here and a single generic executor runs it.
// Keeping this pure + side-effect-free (it only reads process.env stage ids)
// makes the §8 routing table directly testable, and keeps the route handler thin.
//
// The SERVER chooses every destination stage in this file — this is the ONLY
// place the revival-vs-finance branch is decided (by which stage is picked). GHL
// never branches; it just reacts to the stage the server places the opp at.

import type { Prisma } from "@prisma/client";

export type Outcome =
  | "sold"
  | "demo_not_sold"
  | "no_show"
  | "porched"
  | "reschedule";

export const VALID_OUTCOMES = new Set<string>([
  "sold",
  "demo_not_sold",
  "no_show",
  "porched",
  "reschedule",
]);

export interface DispoPlan {
  // DB
  leadStatus: Prisma.LeadUpdateInput["status"] | null; // null = leave unchanged (Book Now)
  leadData: Prisma.LeadUpdateInput; // extra dispo fields written to Lead
  inspectionOutcome: string | null;
  botStage: string | null; // new srBotStage → syncPhaseTransition + srLead; null = no phase change
  srStatus: string | null; // GHL SrLead custom-object status mirror
  // Inspection opp resolution (Inspection pipeline)
  inspectionResolveStage: string | undefined; // resolved env-var VALUE
  inspectionStatus: "won" | "lost" | null;
  // §8 nuance + reporting
  srDispoContext: string | null; // verbatim vocabulary (dispo-context.ts); null = none
  reportingTag: string | null;
  // Revival opp creation (Revival pipeline)
  revivalStage: string | undefined; // resolved env-var VALUE; undefined = no Revival opp
  revivalSourceName: string;
  // §12 Pattern B — the LEFT pipeline whose tag set the crossing purges (in the
  // resolve → purge → create order). "inspection" for every dispo that crosses
  // Inspection→Revival; null when there is no crossing (SOLD, Book Now). The route
  // maps this to pipeline-tags.purgePipelineTags so dispo-plan stays import-pure.
  purgePipeline: "inspection" | null;
  // misc
  managerNotify: boolean;
  exitSignal: string; // recorded in Conversation.phaseHistory[].exitSignal
}

// Build the plan for an outcome. Returns { error } for invalid input (caller maps
// to a 422). Reads process.env stage ids at call time so test/runtime envs apply.
export function planDispo(
  outcome: Outcome,
  fork: Record<string, unknown>,
): DispoPlan | { error: string } {
  const dispoNotes = (fork.dispoNotes as string | null) ?? null;

  switch (outcome) {
    // ── SOLD → won; no Revival lead ──────────────────────────────────────────
    case "sold":
      return {
        leadStatus: "PENDING_SOLD_CONFIRMATION",
        leadData: {},
        inspectionOutcome: "sold",
        botStage: "silent",
        srStatus: "SOLD",
        inspectionResolveStage: process.env.GHL_STAGE_INSPECTION_PENDING_SOLD,
        inspectionStatus: "won",
        srDispoContext: null,
        reportingTag: "sr_pending_sold",
        revivalStage: undefined,
        revivalSourceName: "",
        purgePipeline: null, // SOLD stays in Inspection (won) — no crossing
        managerNotify: true,
        exitSignal: "DISPO_SOLD",
      };

    // ── NO SHOW → lost; Revival opp at Reschedule stage ──────────────────────
    case "no_show":
      return {
        leadStatus: "NO_SHOW",
        leadData: { dispoNotes },
        inspectionOutcome: "no_show",
        botStage: "reschedule",
        srStatus: "NO_SHOW",
        inspectionResolveStage: process.env.GHL_STAGE_NO_SHOW,
        inspectionStatus: "lost",
        srDispoContext: "no_show",
        reportingTag: "no_show",
        revivalStage: process.env.GHL_STAGE_RESCHEDULING,
        revivalSourceName: "revival:no_show",
        purgePipeline: "inspection",
        managerNotify: false,
        exitSignal: "DISPO_NO_SHOW",
      };

    // ── PORCHED (toggle: door/soft) → lost; Revival opp at Reschedule stage ───
    // FLAG: there is no dedicated Inspection-pipeline "Porched" stage in .env, so
    // the Inspection opp resolves to NO_SHOW (the scheduled inspection didn't
    // occur — lost either way). The door/soft NUANCE rides in sr_dispo_context;
    // the reschedule handler derives porched_door/porched_soft from it.
    case "porched": {
      const toggle = (fork.porchedContext as string | null) ?? "door";
      const ctx = toggle === "soft" ? "soft" : "door"; // only door | soft are valid here
      return {
        leadStatus: "NO_SHOW",
        leadData: { rescheduleReason: "porched", dispoNotes },
        inspectionOutcome: "porched",
        botStage: "reschedule",
        srStatus: "NO_SHOW",
        inspectionResolveStage: process.env.GHL_STAGE_NO_SHOW,
        inspectionStatus: "lost",
        srDispoContext: ctx,
        reportingTag: "porched",
        revivalStage: process.env.GHL_STAGE_RESCHEDULING,
        revivalSourceName: "revival:porched",
        purgePipeline: "inspection",
        managerNotify: false,
        exitSignal: "DISPO_PORCHED",
      };
    }

    // ── RESCHEDULE — two paths ───────────────────────────────────────────────
    case "reschedule": {
      const reschedulePath = (fork.reschedulePath as string | null) ?? "office";

      // Book Now (rep books live — Step 1d): the booking modal already created a
      // fresh appointment + inspection client-side, so the dispo handler does NOT
      // resolve/move opps, tag, or change phase. It only records the rep's notes.
      if (reschedulePath === "manual") {
        return {
          leadStatus: null,
          leadData: { rescheduleReason: "manual", dispoNotes },
          inspectionOutcome: null,
          botStage: null,
          srStatus: null,
          inspectionResolveStage: undefined,
          inspectionStatus: null,
          srDispoContext: null,
          reportingTag: null,
          revivalStage: undefined,
          revivalSourceName: "",
          purgePipeline: null, // Book Now creates a fresh appt client-side; no crossing
          managerNotify: false,
          exitSignal: "DISPO_BOOK_NOW",
        };
      }

      // Send to Office → lost; Revival opp at Reschedule stage. No dedicated
      // Inspection "reschedule-lost" stage exists; resolve to NO_SHOW (the
      // appointment didn't happen) and FLAG for Sprint-8 GHL review.
      return {
        leadStatus: null, // no LeadStatus enum fits "rescheduling"; status unchanged
        leadData: { rescheduleReason: "office", dispoNotes },
        inspectionOutcome: null,
        botStage: "reschedule",
        srStatus: null,
        inspectionResolveStage: process.env.GHL_STAGE_NO_SHOW,
        inspectionStatus: "lost",
        srDispoContext: "simple",
        reportingTag: "reschedule_office",
        revivalStage: process.env.GHL_STAGE_RESCHEDULING,
        revivalSourceName: "revival:reschedule",
        purgePipeline: "inspection",
        managerNotify: false,
        exitSignal: "DISPO_RESCHEDULE_OFFICE",
      };
    }

    // ── DEMO NOT SOLD — reasons 1–5 OR finance decline ───────────────────────
    case "demo_not_sold": {
      const objection = fork.dispoPrimaryObjection as string | undefined;
      if (!objection) return { error: "Primary objection is required" };
      const isFinanceDecline = objection === "finance_decline";

      if (isFinanceDecline) {
        // Finance Decline → Finance Discovery stage. The destination STAGE is the
        // branch — the finance handler derives affordabilityIsReal from the stage.
        return {
          leadStatus: "DEMO_NOT_SOLD",
          leadData: { dispoPrimaryObjection: objection, dispoNotes },
          inspectionOutcome: "demo_not_sold",
          botStage: "finance",
          srStatus: "DEMO_NOT_SOLD",
          inspectionResolveStage: process.env.GHL_STAGE_DEMO_NOT_SOLD,
          inspectionStatus: "lost",
          srDispoContext: null, // finance stage says "finance"; nuance is empty (§8)
          reportingTag: "sr_finance_declined",
          revivalStage: process.env.GHL_STAGE_FINANCE_DISCOVERY,
          revivalSourceName: "revival:finance",
          purgePipeline: "inspection",
          managerNotify: false,
          exitSignal: "DISPO_FINANCE_DECLINE",
        };
      }

      // Reasons 1–5 → Revival stage (objection-excavation). sr_dispo_context = the
      // objection; the revival handler seeds it as the model's starting read.
      return {
        leadStatus: "DEMO_NOT_SOLD",
        leadData: { dispoPrimaryObjection: objection, dispoNotes },
        inspectionOutcome: "demo_not_sold",
        botStage: "revival",
        srStatus: "DEMO_NOT_SOLD",
        inspectionResolveStage: process.env.GHL_STAGE_DEMO_NOT_SOLD,
        inspectionStatus: "lost",
        srDispoContext: objection, // think_about_it | price | urgency | insurance | other
        reportingTag: "sr_demo_not_sold",
        revivalStage: process.env.GHL_STAGE_FOLLOW_UP_ACTIVE,
        revivalSourceName: "revival:demo_not_sold",
        purgePipeline: "inspection",
        managerNotify: false,
        exitSignal: "DISPO_DEMO_NOT_SOLD",
      };
    }

    default:
      return { error: "Invalid outcome" };
  }
}
