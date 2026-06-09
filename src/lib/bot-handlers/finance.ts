// ── FINANCE HANDLER — LIVE ON THE NEW ENGINE (Sprint 5 cutover) ──────────────
//
// Jordan's finance-discovery mission on the shared composed-prompt JSON engine,
// via jordan-core's runJordanTurn. REPLACES the old string-mode inline
// handleFinanceWebhook in central/route.ts and the dedicated ghl/finance route
// (both deleted in Sprint 5). The credit/finance decline sets affordabilityIsReal
// here (system-authored), which ACTIVATES OVERRIDE.finance.affordability_real — the
// mission never treats affordability as a value problem and never emits
// NOT_INTERESTED before the alternative-path menu is explored.

import { writeSystemFields, type SystemAuthoredFields } from "@/src/lib/conversation";
import { runJordanTurn, type JordanIoDeps } from "@/src/lib/bot-handlers/jordan-core";
import { loadRecoveryContext } from "@/src/lib/bot-handlers/jordan-recovery";
import type { Phase } from "@/src/lib/bot-v2/types";
import type { Lead, SrLead } from "@prisma/client";

const PHASE: Phase = "finance";

export async function handleFinanceWebhook(
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
  // affordabilityIsReal = true is the finance trigger (credit_fail_triggered /
  // finance_retry): the lead WANTED to buy but couldn't get approved. This
  // activates the dignity-first finance override.
  const recovery = await loadRecoveryContext(lead);
  const sysFields: Partial<SystemAuthoredFields> = {
    leadId: lead.id,
    repName: recovery.repName,
    consequenceLikelySurfaced: recovery.consequenceLikelySurfaced,
    daysSinceAppointment: recovery.daysSinceAppointment,
    affordabilityIsReal: true,
  };
  const convo = await writeSystemFields(ghlContactId, sysFields, { currentPhase: PHASE, leadId: lead.id });

  // ── Run the shared Jordan recovery turn ─────────────────────────────────────
  await runJordanTurn(
    { lead, ghlContactId, trigger, inboundMsg, convo },
    {
      phase: PHASE,
      fromStage: "sr_credit_fail",
      openerInstruction:
        `[system: finance activation — the lead wanted to buy but couldn't get approved ` +
        `(affordabilityIsReal). Send your dignity-first opener: affordability is REAL, not a value ` +
        `problem. Do NOT surface value. Pivot to payment STRUCTURE and begin surfacing alternative ` +
        `payment paths. No prior conversation.]`,
    },
    deps,
  );
}
