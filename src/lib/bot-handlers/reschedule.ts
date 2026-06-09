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
  },
  deps: JordanIoDeps = {},
): Promise<void> {
  const { lead, srLead, ghlContactId, trigger, inboundMsg } = ctx;
  void srLead;

  // ── System-authored recovery context → Conversation (read-only for Jordan) ──
  const recovery = await loadRecoveryContext(lead);
  const rescheduleSubCase = deriveRescheduleSubCase(lead);
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
    { lead, ghlContactId, trigger, inboundMsg, convo },
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
