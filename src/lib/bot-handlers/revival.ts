// ── REVIVAL HANDLER — LIVE ON THE NEW ENGINE (Sprint 5 cutover) ──────────────
//
// Jordan's revival mission on the shared composed-prompt JSON engine
// (runComposedBotTurn, ARCHITECTURE §4/§5) — same live loop as Alex's handlers,
// via jordan-core's runJordanTurn. This REPLACES the old string-mode inline
// handleRevivalWebhook in central/route.ts and the dedicated ghl/revival route
// (both deleted in Sprint 5). Reply generation, signal handling, and state all
// flow through the one contract + repair ladder; cross-phase state lives in the
// Conversation record behind the airtight authorship seam.

import { writeSystemFields, type SystemAuthoredFields } from "@/src/lib/conversation";
import { runJordanTurn, type JordanIoDeps } from "@/src/lib/bot-handlers/jordan-core";
import { loadRecoveryContext } from "@/src/lib/bot-handlers/jordan-recovery";
import type { Phase } from "@/src/lib/bot-v2/types";
import type { Lead, SrLead } from "@prisma/client";

const PHASE: Phase = "revival";

export async function handleRevivalWebhook(
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
  void srLead; // routing already resolved by the caller; kept for signature parity

  // ── System-authored recovery context → Conversation (read-only for Jordan) ──
  const recovery = await loadRecoveryContext(lead);
  const sysFields: Partial<SystemAuthoredFields> = {
    leadId: lead.id,
    repName: recovery.repName,
    consequenceLikelySurfaced: recovery.consequenceLikelySurfaced,
    daysSinceAppointment: recovery.daysSinceAppointment,
  };
  const convo = await writeSystemFields(ghlContactId, sysFields, { currentPhase: PHASE, leadId: lead.id });

  // ── Run the shared Jordan recovery turn ─────────────────────────────────────
  await runJordanTurn(
    {
      lead, ghlContactId, trigger, inboundMsg, convo,
      // Read-seed Jordan's known-problem context (ARCHITECTURE §7) so revival's
      // "read the DB context" / "the leak that got you on the schedule" lands on
      // real facts instead of a re-ask. priorObjection comes from sr_dispo_context
      // (the objection that led here, §8), falling back to the dispo field.
      // §8 fallback order: the webhook-supplied sr_dispo_context (Sprint 8 customData),
      // then the durable Lead.srDispoContext mirror (defense-in-depth while the GHL
      // field/webhook roll out), then the legacy dispoPrimaryObjection. Reschedule
      // already falls through the mirror (deriveRescheduleSubCase); revival now matches
      // so the dispo nuance reaches Jordan's opener regardless of which carrier is live.
      readSeed: {
        inspectionFindings: recovery.inspectionFindings,
        priorObjection:
          srDispoContext ?? lead.srDispoContext ?? recovery.dispoPrimaryObjection,
      },
    },
    {
      phase: PHASE,
      fromStage: "sr_follow_up",
      openerInstruction:
        `[system: revival activation — a demo didn't sell. Send your acknowledgment-first opener. ` +
        `Name what happened, validate it, never defend the rep, and begin surfacing the REAL objection ` +
        `underneath the stated reason. No prior conversation.]`,
    },
    deps,
  );
}
