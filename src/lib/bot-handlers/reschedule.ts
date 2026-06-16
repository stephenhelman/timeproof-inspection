// ── RESCHEDULE HANDLER — LIVE ON THE NEW ENGINE (Sprint 5 cutover) ───────────
//
// Jordan's reschedule mission on the shared composed-prompt JSON engine, via
// jordan-core's runJordanTurn. REPLACES the old string-mode inline
// handleRescheduleWebhook in central/route.ts and the dedicated ghl/reschedule
// route (both deleted in Sprint 5). The four sub-cases (no_show / porched_door /
// porched_soft / simple) are derived system-side here and injected as read-only
// context; the mission file + methodology openers route on rescheduleSubCase.

import { writeSystemFields, type SystemAuthoredFields } from "@/src/lib/conversation";
import { runJordanTurn, type JordanIoDeps } from "@/src/lib/bot-handlers/jordan-core";
import { loadRecoveryContext, deriveRescheduleSubCase } from "@/src/lib/bot-handlers/jordan-recovery";
import type { Phase } from "@/src/lib/bot-v2/types";
import type { Lead, SrLead } from "@prisma/client";

const PHASE: Phase = "reschedule";

export async function handleRescheduleWebhook(
  ctx: {
    lead: Lead;
    srLead: SrLead;
    ghlContactId: string;
    trigger: string;
    inboundMsg: string;
    srDispoContext?: string | null;
  },
  deps: JordanIoDeps = {},
): Promise<void> {
  const { lead, srLead, ghlContactId, trigger, inboundMsg, srDispoContext } = ctx;
  void srLead;

  // ── System-authored recovery context → Conversation (read-only for Jordan) ──
  // Derive the sub-case from (stage + sr_dispo_context) — door→porched_door,
  // soft→porched_soft, no_show, simple — falling back to the legacy heuristic.
  const recovery = await loadRecoveryContext(lead);
  const rescheduleSubCase = deriveRescheduleSubCase(lead, srDispoContext);
  const sysFields: Partial<SystemAuthoredFields> = {
    leadId: lead.id,
    repName: recovery.repName,
    consequenceLikelySurfaced: recovery.consequenceLikelySurfaced,
    daysSinceAppointment: recovery.daysSinceAppointment,
    rescheduleSubCase,
  };
  const convo = await writeSystemFields(ghlContactId, sysFields, { currentPhase: PHASE, leadId: lead.id });

  // ── Run the shared Jordan recovery turn ─────────────────────────────────────
  await runJordanTurn(
    {
      lead, ghlContactId, trigger, inboundMsg, convo,
      // Read-seed known-problem context (ARCHITECTURE §7) so a porched/no-show
      // rebuild references the real prior problem rather than re-asking.
      readSeed: { inspectionFindings: recovery.inspectionFindings, priorObjection: recovery.dispoPrimaryObjection },
    },
    {
      phase: PHASE,
      fromStage: "sr_reschedule",
      openerInstruction:
        `[system: reschedule activation — read rescheduleSubCase (${rescheduleSubCase}) and ` +
        `consequenceLikelySurfaced, then send the matching sub-case opener from the methodology. ` +
        `Acknowledge first; don't over-pressure (no_show/porched) or over-work (simple). No prior conversation.]`,
    },
    deps,
  );
}
