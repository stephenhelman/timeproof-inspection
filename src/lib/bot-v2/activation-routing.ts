// THE bot-activation routing table as DATA (ARCHITECTURE §8). Central resolves a
// (trigger, srBotStage) pair to a single ActivationRoute here, and the route
// handler runs it. Pure + side-effect-free (no DB, no GHL) so the §8 rule —
// "WHICH bot is the STAGE; the trigger only says WHY" — is directly unit-testable,
// exactly like the disposition table in ./dispo-plan.ts.
//
// The single invariant this encodes: the trigger NEVER selects the bot. Every
// activation (inbound SMS, an Alex stage handoff, a Jordan *_activate) dispatches
// by srBotStage. The trigger is forwarded to the handler only so it knows WHY it
// woke (send an opener vs answer a reply) — see §8 "Stage vs. context".
//
// The ONE exception below is NOT trigger-based bot selection: it targets a lead the
// server deliberately parked in "silent" (post-SOFT_CLOSE), where the stage no longer
// names a mission, so the re-engagement signal carries the mission instead.
//
// SPRINT 9 (Part A): the former second exception — `finance_retry` — is GONE. Finance
// SOFT_CLOSE used to park the lead in "silent", so at 7-day-retry time the stage
// couldn't name the mission and the trigger had to carry it. Finance SOFT_CLOSE now
// moves the opp to the Finance Retry Pending STAGE (srBotStage stays "finance"), so
// `finance_retry` routes by STAGE like every other trigger — the §8 exception is
// resolved, not merely documented.

export type Mission =
  | "nurture"
  | "qualify"
  | "book"
  | "revival"
  | "reschedule"
  | "finance";

export type ActivationRoute =
  // Dispatch to a mission handler chosen by STAGE (the §8 happy path: inbound_sms
  // AND every stage-entry activation trigger land here).
  | { kind: "mission"; mission: Mission }
  // Proactive re-engagement of a PARKED lead. handleReengageWebhook re-derives the
  // mission from the lead's CURRENT stage (mission hint is only a fallback for a
  // lead parked in "silent" after a recovery SOFT_CLOSE).
  | { kind: "reengage" }
  // The lead is intentionally inactive — do nothing.
  | { kind: "silent" }
  // Stage value we don't recognize — log and drop (never guess a bot).
  | { kind: "unknown"; srBotStage: string };

// srBotStage → mission. The stage vocabulary ("qualifying"/"booking") differs from
// the mission/phase vocabulary ("qualify"/"book"); this is the one mapping.
const STAGE_TO_MISSION: Record<string, Mission> = {
  nurture: "nurture",
  qualifying: "qualify",
  booking: "book",
  revival: "revival",
  reschedule: "reschedule",
  finance: "finance",
};

/**
 * Resolve how Central should dispatch this webhook. `trigger` says WHY central was
 * called; `srBotStage` says WHICH bot. Stage ALWAYS wins for an active lead — the
 * single parked-lead re-engagement trigger is the only one examined before stage,
 * and it does not pick the bot from the trigger as a routing shortcut; it exists
 * because a parked lead has no mission stage to read.
 */
export function resolveActivation(
  trigger: string,
  srBotStage: string | null | undefined,
): ActivationRoute {
  // ── Parked-lead re-engagement (the lead is in "silent"; stage can't name it) ──
  if (trigger === "reengage") return { kind: "reengage" };

  // ── Everything else dispatches by STAGE ──────────────────────────────────────
  // inbound_sms AND every stage-entry activation (Alex: new_guide_lead,
  // new_inspection_lead, scheduling_approved, qualified_handoff, stall_followup,
  // stall_exhausted, appointment_confirmed; Jordan: revival_activate /
  // follow_up_triggered, reschedule_activate / reschedule_triggered,
  // finance_activate / credit_fail_triggered; finance_retry now routes by STAGE
  // too — Part A re-enters the Finance Retry Pending stage so it names "finance").
  // The trigger is forwarded to the
  // handler unchanged so it knows opener-vs-reply; it does NOT choose the bot.
  const stage = srBotStage ?? "";
  if (stage === "silent") return { kind: "silent" };
  const mission = STAGE_TO_MISSION[stage];
  return mission ? { kind: "mission", mission } : { kind: "unknown", srBotStage: stage };
}
